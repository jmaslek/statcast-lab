def test_get_weights_known_season():
    from pipeline.compute.woba import get_weights

    w = get_weights(2023)
    assert "wBB" in w
    assert "w1B" in w
    assert "wHR" in w
    assert 0.5 < w["wBB"] < 1.0
    assert 1.5 < w["wHR"] < 2.5


def test_get_weights_unknown_season_falls_back():
    from pipeline.compute.woba import get_weights

    w = get_weights(2099)
    assert "wBB" in w  # Should fall back to latest


def test_calculate_player_woba():
    from pipeline.compute.woba import calculate_player_woba, get_weights

    weights = get_weights(2024)
    woba = calculate_player_woba(
        bb=50,
        hbp=5,
        singles=80,
        doubles=25,
        triples=3,
        hr=30,
        ab=400,
        sf=5,
        weights=weights,
    )
    # A player with 30 HR and .300+ OBP should have a good wOBA
    assert 0.350 < woba < 0.500


def test_calculate_player_woba_zero_denominator():
    from pipeline.compute.woba import calculate_player_woba, get_weights

    weights = get_weights(2024)
    woba = calculate_player_woba(
        bb=0,
        hbp=0,
        singles=0,
        doubles=0,
        triples=0,
        hr=0,
        ab=0,
        sf=0,
        weights=weights,
    )
    assert woba == 0.0
