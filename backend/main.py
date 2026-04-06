"""Точка входа FastAPI-приложения."""

from fastapi import FastAPI

app = FastAPI()


@app.get("/")
async def root():
    """Корневой эндпоинт для проверки работоспособности."""
    return {"message": "Hello World"}


@app.get("/hello/{name}")
async def say_hello(name: str):
    """Тестовый эндпоинт с параметром."""
    return {"message": f"Hello {name}"}
