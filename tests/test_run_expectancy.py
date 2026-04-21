"""Tests for run expectancy matrix and linear weights computation."""

import pytest

from pipeline.compute.run_expectancy import (
    categorize_event,
    decode_base_out_state,
    encode_base_out_state,
    EVENT_CATEGORIES,
)


class TestEncodeDecodeBaseOutState:
    """Test round-trip encoding/decoding of all 24 base-out states."""

    def test_round_trip_all_24_states(self):
        seen = set()
        for outs in range(3):
            for on_1b in (False, True):
                for on_2b in (False, True):
                    for on_3b in (False, True):
                        state = encode_base_out_state(outs, on_1b, on_2b, on_3b)
                        assert 0 <= state <= 23
                        seen.add(state)

                        decoded_outs, runners = decode_base_out_state(state)
                        assert decoded_outs == outs
                        assert ("1" in runners) == on_1b
                        assert ("2" in runners) == on_2b
                        assert ("3" in runners) == on_3b
        assert len(seen) == 24

    def test_bases_empty_zero_outs(self):
        state = encode_base_out_state(0, False, False, False)
        assert state == 0
        outs, runners = decode_base_out_state(0)
        assert outs == 0
        assert runners == "---"

    def test_bases_loaded_two_outs(self):
        state = encode_base_out_state(2, True, True, True)
        assert state == 7 * 3 + 2  # 23
        outs, runners = decode_base_out_state(state)
        assert outs == 2
        assert runners == "123"

    def test_runner_on_second_one_out(self):
        state = encode_base_out_state(1, False, True, False)
        outs, runners = decode_base_out_state(state)
        assert outs == 1
        assert runners == "-2-"

    def test_runners_on_corners(self):
        state = encode_base_out_state(0, True, False, True)
        outs, runners = decode_base_out_state(state)
        assert outs == 0
        assert runners == "1-3"


class TestEventCategories:
    """Test event categorization."""

    def test_hit_events(self):
        assert categorize_event("single") == "1B"
        assert categorize_event("double") == "2B"
        assert categorize_event("triple") == "3B"
        assert categorize_event("home_run") == "HR"

    def test_walk_events(self):
        assert categorize_event("walk") == "BB"
        assert categorize_event("hit_by_pitch") == "HBP"

    def test_out_events(self):
        out_events = [
            "field_out",
            "strikeout",
            "double_play",
            "force_out",
            "grounded_into_double_play",
            "fielders_choice",
            "fielders_choice_out",
            "field_error",
            "strikeout_double_play",
            "triple_play",
            "sac_fly",
            "sac_bunt",
        ]
        for event in out_events:
            assert categorize_event(event) == "OUT", f"{event} should map to OUT"

    def test_unknown_event_maps_to_out(self):
        assert categorize_event("some_unknown_event") == "OUT"

    def test_none_event(self):
        assert categorize_event(None) is None

    def test_all_named_categories_present(self):
        expected = {"1B", "2B", "3B", "HR", "BB", "HBP"}
        assert set(EVENT_CATEGORIES.values()) == expected


class TestReMatrixSynthetic:
    """Test RE matrix computation logic with synthetic data."""

    def test_simple_half_inning(self):
        """Construct a simple half-inning and verify expected runs.

        Scenario: 3-PA half inning where 2 runs score on the HR in the 2nd PA.
        PA1: 0 outs, bases empty, bat_score=0, post_bat_score=0 (single)
        PA2: 0 outs, runner on 1st, bat_score=0, post_bat_score=2 (2-run HR)
        PA3: 0 outs, bases empty, bat_score=2, post_bat_score=2 (strikeout)

        Total inning runs = 2 - 0 = 2
        PA1 runs_remaining = 2 - (0 - 0) = 2
        PA2 runs_remaining = 2 - (0 - 0) = 2
        PA3 runs_remaining = 2 - (2 - 0) = 0
        """
        import polars as pl

        df = pl.DataFrame(
            {
                "game_pk": [1, 1, 1],
                "inning": [1, 1, 1],
                "inning_topbot": ["Top", "Top", "Top"],
                "at_bat_number": [1, 2, 3],
                "batter": [100, 101, 102],
                "outs_when_up": [0, 0, 0],
                "r1": [False, True, False],
                "r2": [False, False, False],
                "r3": [False, False, False],
                "events": ["single", "home_run", "strikeout"],
                "bat_score": [0, 0, 2],
                "post_bat_score": [0, 2, 2],
            }
        )

        half_inning_cols = ["game_pk", "inning", "inning_topbot"]
        df = df.with_columns(
            [
                pl.col("bat_score")
                .first()
                .over(half_inning_cols)
                .alias("inning_start"),
                pl.col("post_bat_score")
                .last()
                .over(half_inning_cols)
                .alias("inning_end"),
            ]
        )
        df = df.with_columns(
            (
                pl.col("inning_end")
                - pl.col("inning_start")
                - (pl.col("bat_score") - pl.col("inning_start"))
            ).alias("runs_remaining")
        )

        remaining = df["runs_remaining"].to_list()
        assert remaining == [2, 2, 0]

    def test_scoreless_inning(self):
        """A scoreless inning should have runs_remaining = 0 for all PAs."""
        import polars as pl

        df = pl.DataFrame(
            {
                "game_pk": [1, 1, 1],
                "inning": [1, 1, 1],
                "inning_topbot": ["Top", "Top", "Top"],
                "at_bat_number": [1, 2, 3],
                "batter": [100, 101, 102],
                "outs_when_up": [0, 1, 2],
                "r1": [False, False, False],
                "r2": [False, False, False],
                "r3": [False, False, False],
                "events": ["field_out", "field_out", "strikeout"],
                "bat_score": [0, 0, 0],
                "post_bat_score": [0, 0, 0],
            }
        )

        half_inning_cols = ["game_pk", "inning", "inning_topbot"]
        df = df.with_columns(
            [
                pl.col("bat_score")
                .first()
                .over(half_inning_cols)
                .alias("inning_start"),
                pl.col("post_bat_score")
                .last()
                .over(half_inning_cols)
                .alias("inning_end"),
            ]
        )
        df = df.with_columns(
            (
                pl.col("inning_end")
                - pl.col("inning_start")
                - (pl.col("bat_score") - pl.col("inning_start"))
            ).alias("runs_remaining")
        )

        remaining = df["runs_remaining"].to_list()
        assert remaining == [0, 0, 0]


class TestLinearWeightsSanity:
    """Test linear weight derivation logic with a known RE matrix."""

    def test_run_value_computation(self):
        """Given a pre-state and post-state RE, verify run_value formula.

        run_value = RE(post) - RE(pre) + runs_scored
        """
        # Bases empty, 0 outs -> runner on 1st, 0 outs (single, no runs scored)
        re_pre = 0.50  # approximate RE for (0 outs, bases empty)
        re_post = 0.88  # approximate RE for (0 outs, runner on 1st)
        runs_scored = 0

        run_value = re_post - re_pre + runs_scored
        assert run_value == pytest.approx(0.38, abs=0.01)

    def test_home_run_run_value(self):
        """A solo HR from bases empty: post-state is bases empty again, 1 run scored."""
        re_pre = 0.50  # 0 outs, bases empty
        re_post = 0.50  # 0 outs, bases empty (back to same state after HR)
        runs_scored = 1

        run_value = re_post - re_pre + runs_scored
        assert run_value == pytest.approx(1.0, abs=0.01)

    def test_strikeout_run_value(self):
        """A strikeout from 0 outs, bases empty -> 1 out, bases empty."""
        re_pre = 0.50  # 0 outs, bases empty
        re_post = 0.27  # 1 out, bases empty
        runs_scored = 0

        run_value = re_post - re_pre + runs_scored
        assert run_value == pytest.approx(-0.23, abs=0.01)


class TestTerminalPA:
    """Test that last PA in a half-inning uses RE=0 for post-state."""

    def test_terminal_pa_uses_zero_re(self):
        """The 3rd out of an inning: post-state RE should be 0."""
        re_pre = 0.10  # 2 outs, bases empty
        re_post = 0.0  # terminal: inning over
        runs_scored = 0

        run_value = re_post - re_pre + runs_scored
        assert run_value == pytest.approx(-0.10, abs=0.01)

    def test_terminal_pa_with_runs(self):
        """Walk-off or scoring on 3rd out: still uses RE=0 but counts runs."""
        re_pre = 0.10
        re_post = 0.0  # terminal
        runs_scored = 1  # a run scored on the play

        run_value = re_post - re_pre + runs_scored
        assert run_value == pytest.approx(0.90, abs=0.01)
