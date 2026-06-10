from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"),
        extra="ignore",
    )

    openai_api_key: str = ""
    # embedded = FalkorDB Lite (no Docker), falkordb = Docker/server, neo4j = Neo4j
    graph_backend: str = "embedded"
    falkordb_host: str = "localhost"
    falkordb_port: int = 6380
    embedded_db_path: str = "data/graphiti.db"
    neo4j_uri: str = "bolt://localhost:7687"
    neo4j_user: str = "neo4j"
    neo4j_password: str = "rechtslens123"
    oldp_api_base: str = "https://de.openlegaldata.io/api"
    oldp_api_key: str = ""
    bund_recht_api: str = "https://testphase.rechtsinformationen.bund.de"
    auto_seed_graph: bool = False
    backend_port: int = 8000
    cors_origins: str = (
        "http://localhost:3000,http://localhost:3001,http://localhost:3002,"
        "http://127.0.0.1:3000,http://127.0.0.1:3001,http://127.0.0.1:3002"
    )
    graphiti_telemetry_enabled: bool = False
    semaphore_limit: int = 5
    legal_search_bfs_depth: int = 5
    legal_search_bm25_weight: float = 3.0
    legal_search_limit: int = 12
    legal_search_runtime_fetch: bool = True
    legal_search_min_quality: float = 0.12
    legal_search_runtime_weight: float = 4.0

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
