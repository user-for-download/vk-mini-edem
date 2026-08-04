# Edem — Сервис попутных поездок (VK Mini App)

Монорепозиторий проекта **Edem** (аналог BlaBlaCar для VK Mini Apps). Приложение позволяет водителям предлагать поездки, а пассажирам — бронировать места, оставлять отзывы и просматривать историю своих поездок.

## 🌟 Основные возможности

- **Поиск поездок**: удобный поиск с фильтрацией по дате и городам отправления/прибытия.
- **Создание поездок**: для водителей с возможностью указания цены, количества мест, дополнительных опций (теги) и комментария.
- **Бронирование мест**: пассажиры могут бронировать места в активных поездках.
- **Отзывы и рейтинги**: возможность оставить отзыв после поездки. Система рейтингов водителей и пассажиров.
- **Управление автомобилями**: добавление и редактирование информации об авто для водителей.
- **Интеграция с VK**: авторизация через VK ID (имитация в Dev-режиме) и использование компонентов VKUI.

## 📁 Структура монорепозитория

```edem/
├── mini-app/                    # Frontend-приложение на React + VKUI (Vite)
│   ├── src/
│   │   ├── api/                 # HTTP-клиент + API-запросы
│   │   ├── components/          # Компоненты интерфейса
│   │   ├── hooks/               # Кастомные React-хуки
│   │   ├── panels/              # Панели навигации (VKUI)
│   │   ├── modals/              # Модальные окна
│   │   ├── router/              # Роутинг (vk-mini-apps-router)
│   │   ├── store/               # Zustand сторы
│   │   └── views/               # Экраны (Views)
│   └── vite.config.ts
│
├── backend/                     # Backend-сервис на Hono + Prisma ORM
│   ├── prisma/
│   │   ├── schema.prisma        # Модели данных (User, Car, Trip, Booking, Review)
│   │   └── seed.ts              # Наполнение тестовыми данными
│   ├── src/
│   │   ├── auth/                # Авторизация
│   │   ├── trips/               # Эндпоинты поездок
│   │   ├── bookings/            # Бронирования
│   │   ├── reviews/             # Отзывы
│   │   ├── users/               # Профили пользователей
│   │   ├── app.ts               # Hono-приложение
│   │   └── index.ts             # Серверный entry point
│   └── .env                     # Переменные окружения (БД, токены)
│
├── packages/
│   └── contracts/               # Общий пакет Zod-схем и DTO
│       ├── src/
│       │   ├── schemas/         # Zod-схемы сущностей
│       │   └── dto/             # Схемы входных/выходных DTO
│       └── tests/               # Юнит-тесты контрактов (Vitest)
│
└── package.json                 # Корневой package.json (npm workspaces)
```

## 🚀 Команды разработки

В корне проекта доступны следующие скрипты:

### Запуск проекта (Фронтенд + Бэкенд)
```bash
npm run dev
```
Команда параллельно запустит бэкенд на порту 3001 и фронтенд (Vite) на порту 3000.

### Установка зависимостей
```bash
npm install
```

### Сборка приложения (включая общий пакет)
```bash
npm run build
```

### Миграции и наполнение базы данных
```bash
npm run db:migrate        # Применить миграции БД (Prisma)
npm run db:generate       # Сгенерировать Prisma Client
npm run db:seed           # Заполнить БД тестовыми данными (моки)
```

### Проверка типов и линтинг
```bash
npm run typecheck         # Запуск tsc --noEmit во всех воркспейсах
npm run test              # Запуск юнит-тестов (Vitest)
```

## ⚙️ Настройка окружения

Для локального запуска бэкенда необходим файл `backend/.env` с переменными окружения.

Пример `backend/.env`:
```env
DATABASE_URL="postgresql://user:password@host:port/db?sslmode=require"
NODE_ENV=development
ALLOW_DEV_AUTH=true
JWT_SECRET=your-jwt-secret-key-32-chars-long
CORS_ORIGINS=http://localhost:3000
BACKEND_PORT=3001
```

## 🛠 Технологии

- **Frontend**: React 19, VKUI, Zustand, TanStack Query, vk-mini-apps-router, Vite
- **Backend**: Hono, Node.js, Prisma ORM, PostgreSQL, Zod
- **Монорепозиторий**: npm workspaces, TypeScript

