import clickhouse_connect


def get_client(
    host: str = "localhost",
    port: int = 8123,
    username: str = "mlb",
    password: str = "mlb",
    database: str = "mlb",
) -> clickhouse_connect.driver.Client:
    return clickhouse_connect.get_client(
        host=host, port=port, username=username, password=password, database=database
    )
