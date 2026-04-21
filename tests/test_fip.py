"""Tests for FIP computation."""

import pytest

from pipeline.compute._common import (
    ONE_OUT_EVENTS as _ONE_OUT_EVENTS,
    THREE_OUT_EVENTS as _THREE_OUT_EVENTS,
    TWO_OUT_EVENTS as _TWO_OUT_EVENTS,
)


class TestOutClassification:
    """Verify out events are properly categorized."""

    def test_no_overlap_between_out_groups(self):
        assert _ONE_OUT_EVENTS & _TWO_OUT_EVENTS == set()
        assert _ONE_OUT_EVENTS & _THREE_OUT_EVENTS == set()
        assert _TWO_OUT_EVENTS & _THREE_OUT_EVENTS == set()

    def test_common_outs_are_one_out(self):
        assert "strikeout" in _ONE_OUT_EVENTS
        assert "field_out" in _ONE_OUT_EVENTS
        assert "force_out" in _ONE_OUT_EVENTS

    def test_double_play_is_two_outs(self):
        assert "grounded_into_double_play" in _TWO_OUT_EVENTS
        assert "double_play" in _TWO_OUT_EVENTS
        assert "strikeout_double_play" in _TWO_OUT_EVENTS

    def test_triple_play_is_three_outs(self):
        assert "triple_play" in _THREE_OUT_EVENTS

    def test_non_out_plate_appearances_are_not_counted_as_outs(self):
        assert "field_error" not in _ONE_OUT_EVENTS
        assert "catcher_interf" not in _ONE_OUT_EVENTS


class TestFIPFormula:
    """Test the FIP formula math."""

    def test_basic_fip_calculation(self):
        """FIP = ((13*HR + 3*(BB+HBP) - 2*K) / IP) + constant"""
        hr, bb, hbp, k, ip = 20, 50, 5, 200, 180.0
        constant = 3.2

        fip = ((13 * hr + 3 * (bb + hbp) - 2 * k) / ip) + constant
        # (260 + 165 - 400) / 180 + 3.2 = 25/180 + 3.2 = 0.139 + 3.2 = 3.339
        assert fip == pytest.approx(3.339, abs=0.01)

    def test_high_k_low_fip(self):
        """A pitcher with elite K rate and low HR should have low FIP."""
        hr, bb, hbp, k, ip = 10, 30, 3, 250, 200.0
        constant = 3.2

        fip = ((13 * hr + 3 * (bb + hbp) - 2 * k) / ip) + constant
        assert fip < 3.0

    def test_high_hr_high_fip(self):
        """A pitcher who gives up lots of HRs should have high FIP."""
        hr, bb, hbp, k, ip = 40, 60, 5, 100, 150.0
        constant = 3.2

        fip = ((13 * hr + 3 * (bb + hbp) - 2 * k) / ip) + constant
        assert fip > 5.0

    def test_fip_constant_anchors_to_ra9(self):
        """FIP constant = lg_RA/9 - lg_FIP_component.

        So league-average FIP should equal league RA/9.
        """
        lg_hr, lg_bb, lg_hbp, lg_k = 5000, 15000, 2000, 40000
        lg_ip = 43000.0
        lg_ra9 = 4.3

        lg_fip_component = (13 * lg_hr + 3 * (lg_bb + lg_hbp) - 2 * lg_k) / lg_ip
        fip_constant = lg_ra9 - lg_fip_component

        # Now compute "league FIP" using league totals — should equal lg_RA/9
        league_fip = lg_fip_component + fip_constant
        assert league_fip == pytest.approx(lg_ra9, abs=0.001)
