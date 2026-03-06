"""ClickHouse client for the backend API."""

import clickhouse_connect

Client = clickhouse_connect.driver.Client

_client: Client | None = None


def get_client() -> Client:
    global _client
    if _client is None:
        _client = clickhouse_connect.get_client(
            host="localhost", port=8123, username="mlb", password="mlb", database="mlb"
        )
    return _client


def close_client() -> None:
    global _client
    if _client is not None:
        _client.close()
        _client = None
