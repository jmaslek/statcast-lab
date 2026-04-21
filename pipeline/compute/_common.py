import clickhouse_connect
import polars as pl

Client = clickhouse_connect.driver.Client

HALF_INNING_COLS = ["game_pk", "inning", "inning_topbot"]

ONE_OUT_EVENTS = {
    "field_out",
    "strikeout",
    "force_out",
    "fielders_choice_out",
    "sac_fly",
    "sac_bunt",
    "fielders_choice",
    "other_out",
}
TWO_OUT_EVENTS = {
    "double_play",
    "grounded_into_double_play",
    "strikeout_double_play",
    "sac_bunt_double_play",
    "sac_fly_double_play",
}
THREE_OUT_EVENTS = {"triple_play"}

NON_PA_EVENTS = {"truncated_pa"}


def outs_recorded_sql() -> str:
    one = ", ".join(f"'{e}'" for e in sorted(ONE_OUT_EVENTS))
    two = ", ".join(f"'{e}'" for e in sorted(TWO_OUT_EVENTS))
    three = ", ".join(f"'{e}'" for e in sorted(THREE_OUT_EVENTS))
    return (
        f"countIf(events IN ({one})) "
        f"+ countIf(events IN ({two})) * 2 "
        f"+ countIf(events IN ({three})) * 3"
    )


def non_pa_filter_sql() -> str:
    excluded = ", ".join(f"'{e}'" for e in sorted(NON_PA_EVENTS))
    return f"AND events NOT IN ({excluded})"


def base_out_state_expr() -> pl.Expr:
    return (
        (
            pl.col("r3").cast(pl.UInt8) * 4
            + pl.col("r2").cast(pl.UInt8) * 2
            + pl.col("r1").cast(pl.UInt8)
        )
        .mul(3)
        .add(pl.col("outs_when_up"))
    )


def re_map_expr(re_matrix: dict[int, float], col: str = "base_out_state") -> pl.Expr:
    expr = pl.lit(0.0)
    for state, er in re_matrix.items():
        expr = pl.when(pl.col(col) == state).then(pl.lit(er)).otherwise(expr)
    return expr


def load_re_matrix(client: Client, season: int) -> dict[int, float]:
    result = client.query(
        """
        SELECT base_out_state, expected_runs
        FROM season_re_matrix FINAL
        WHERE season = {season:UInt16}
        """,
        parameters={"season": season},
    )
    return {row[0]: row[1] for row in result.result_rows}


def delete_season(client: Client, table: str, season: int) -> None:
    client.command(
        f"DELETE FROM {table} WHERE season = {{season:UInt16}}",
        parameters={"season": season},
    )
