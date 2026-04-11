from __future__ import annotations

import uuid


class ChatService:
    """Заготовка под чат (текстовый/voice signalling).

    MVP игры по твоей спеки чат не обязателен, но модуль нужен по структуре.
    """

    async def send_message(self, session_id: uuid.UUID, user_id: uuid.UUID, text: str) -> None:
        # В будущем: персистить/модерировать/рассылать через ws_manager.
        return None


chat_service = ChatService()

