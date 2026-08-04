# Edem — Сервис попутных поездок (VK Mini App)

Монорепозиторий проекта **Edem** (аналог BlaBlaCar для VK Mini Apps).

## 📁 Структура монорепозитория

```
edem/
├── mini-app/                    # Frontend-приложение на React + VKUI (Vite)
│   ├── src/
│   │   ├── api/                 # HTTP-клиент + API-запросы
│   │   ├── components/          # Компоненты интерфейса
│   │   ├── consts/              # Константы
│   │   ├── hooks/               # Кастомные React-хуки
│   │   ├── modals/              # Модальные окна VKUI
│   │   ├── panels/              # Панели навигации
│   │   ├── queries/             # React Query хуки
│   │   ├── router/              # Роутинг (vk-mini-apps-router)
│   │   ├── store/               # Zustand сторы
│   │   ├── views/               # Экраны (Views)
│   │   ├── App.tsx
│   │   ├── AppConfig.tsx
│   │   ├── index.css
│   │   └── main.tsx
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
│
├── backend/                     # Backend-сервис на Hono + Prisma ORM
│   ├── prisma/
│   │   ├── schema.prisma        # Модели данных (User, Car, Trip, Booking, Review)
│   │   └── seed.ts              # Наполнение тестовыми данными
│   ├── src/
│   │   ├── auth/                # Авторизация через VK
│   │   ├── trips/               # Эндпоинты поездок
│   │   ├── bookings/            # Бронирования
│   │   ├── reviews/             # Отзывы
│   │   ├── users/               # Профили пользователей
│   │   ├── app.ts               # Hono-приложение
│   │   ├── db.ts                # Инициализация Prisma Client
│   │   ├── env.ts               # Конфигурация окружения
│   │   └── index.ts             # Серверный entry point
│   ├── package.json
│   └── tsconfig.json
│
├── packages/
│   └── contracts/               # Общий пакет Zod-схем и DTO
│       ├── src/
│       │   ├── schemas/         # Zod-схемы сущностей
│       │   ├── dto/             # Схемы входных/выходных DTO
│       │   └── index.ts
│       ├── tests/               # Юнит-тесты контрактов (Vitest)
│       ├── package.json
│       ├── tsconfig.json
│       └── vitest.config.ts
│
├── package.json                 # Корневой package.json (npm workspaces)
├── tsconfig.json                # Базовый tsconfig
└── README.md
```

## 🚀 Команды разработки

### Установка зависимостей
```bash
npm install
```

### Сборка общего пакета контрактов
```bash
npm run build:contracts
```

### Запуск тестов контрактов
```bash
npm test
```

### Запуск фронтенда (mini-app)
```bash
npm run dev
```

### Запуск бэкенда (backend)
```bash
npm run dev:backend
```

### Параллельный запуск фронтенда и бэкенда
```bash
npm run dev:all
```

### Миграции и сиды базы данных (Prisma)
```bash
npm run db:migrate
npm run db:seed
```
