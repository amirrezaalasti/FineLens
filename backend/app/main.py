import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.graphiti_client import close_graphiti, get_graph_backend_in_use, get_graphiti, graph_episode_count
from app.routers import chat, forms, ingest, sources, users

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        await get_graphiti()
        backend = get_graph_backend_in_use()
        logger.info("Graphiti ready (backend=%s)", backend)

        if settings.auto_seed_graph or await graph_episode_count() == 0:
            from app.ingestion.seed_corpus import seed_legal_corpus

            results = await seed_legal_corpus()
            logger.info(
                "Seeded empty graph: %s episodes (%s)",
                sum(results.values()),
                results,
            )
    except Exception as exc:
        logger.error("Graphiti startup failed: %s", exc)
    yield
    await close_graphiti()


app = FastAPI(
    title="FineLens API",
    description="Transparenter juristischer Assistent mit Graphiti Knowledge Graph",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(sources.router)
app.include_router(chat.router)
app.include_router(users.router)
app.include_router(forms.router)
app.include_router(ingest.router)


@app.get("/")
async def root():
    return {
        "name": "FineLens",
        "tagline": "Transparente Rechtsinformation mit Graphiti",
        "docs": "/docs",
    }
