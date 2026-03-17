# AlwaysAccessibility — 無障礙地圖網站

給身障者、輔具使用者、推嬰兒車家長使用的 Google Maps 無障礙版網站，參考 [Wheelmap](https://wheelmap.org/) 功能設計，整合台灣身障供需資料與 Google 輪椅路線 API。

---

## 技術棧

| 層級 | 技術 |
|------|------|
| 前端 | React 19 + TypeScript + Vite 8 + Tailwind CSS 4 |
| 後端 | Node.js + Express 5 + TypeScript |
| ORM | Prisma 7（PostgreSQL adapter） |
| 資料庫 | PostgreSQL（Supabase 托管） |
| 地圖 | Google Maps JavaScript API（`@vis.gl/react-google-maps`） |
| 狀態管理 | Zustand（前端） |
| 前端部署 | Vercel |
| 後端部署 | Render |

---

## 專案結構

```
AlwaysAccessibility/
├── package.json          ← 根 Yarn Workspaces + concurrently 啟動腳本
├── client/               ← 前端（React + Vite）
│   └── src/
│       ├── pages/
│       │   └── MapPage.tsx        ← 主頁面（地圖、搜尋列、使用者按鈕、定位）
│       ├── components/
│       │   ├── FilterBar.tsx      ← 無障礙類型篩選列
│       │   ├── MapMarkers.tsx     ← 地圖標記（一般地點 + 身障資源點）
│       │   ├── PlaceSidebar.tsx   ← 地點詳情側邊欄（評分 + 收藏）
│       │   └── RoutePanel.tsx     ← 路線規劃面板（含語音導航）
│       └── store/
│           ├── mapStore.ts        ← 地圖全域狀態（Zustand）
│           └── authStore.ts       ← 使用者登入狀態（Zustand + localStorage）
└── server/
    ├── prisma/
    │   └── schema.prisma          ← 資料庫 Schema
    └── src/
        ├── index.ts               ← Express 主程式
        └── routes/
            ├── places.ts          ← Google Places API 代理
            ├── disabilityMap.ts   ← data.taipei 身障資源 API
            ├── directions.ts      ← Google Directions API 代理
            ├── ratings.ts         ← 無障礙評分 CRUD
            ├── bookmarks.ts       ← 收藏地點 CRUD
            └── searchHistory.ts   ← 搜尋紀錄 CRUD
```

---

## 快速開始

### 環境需求

- Node.js >= 20
- Yarn >= 1.22
- PostgreSQL（或 Supabase 連線字串）

### 安裝依賴

```bash
yarn install
```

### 環境變數

**`server/.env`**

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DATABASE
GOOGLE_MAPS_API_KEY=your_google_maps_api_key
CLIENT_URL=http://localhost:5173
PORT=3000
```

**`client/.env`**

```env
VITE_GOOGLE_MAPS_API_KEY=your_google_maps_api_key
VITE_GOOGLE_CLIENT_ID=your_google_oauth_client_id
VITE_API_BASE_URL=http://localhost:3000
```

### 開發模式（同時啟動前後端）

```bash
yarn dev
```

執行流程：
1. `prisma generate && prisma db push`（初始化/同步資料庫）
2. 同時以 `concurrently` 啟動後端（port 3000）與前端（port 5173）

### 建置

```bash
yarn build
```

---

## 功能說明

### 地圖核心

- 以 Google Maps JavaScript API 渲染互動地圖，預設中心為台北市（25.0478, 121.5319）。
- `MapCameraController`：監聽 store 中的 `focusLocation` 自動移動鏡頭。
- `RoutePolyline`：解碼 overview polyline 並在地圖上繪製路線（靛藍色）。
- `MapMarkers`：呈現目前位置（藍點動畫）、地點標記（紫色輪椅圖示，依無障礙入口狀態調整顏色）及身障資源點（橘色圓圈）。

### 篩選器（FilterBar）

| 類型 | 說明 |
|------|------|
| 無障礙餐廳 | Google Places API，類型 `restaurant` |
| 無障礙景點 | Google Places API，類型 `tourist_attraction / museum / park`... |
| 無障礙停車 | Google Places API，類型 `parking` |
| 無障礙廁所 | data.taipei 身障資源 dataset |
| 無障礙坡道 | data.taipei 身障資源 dataset |
| 身障資源圖層 | 一次切換廁所 + 坡道 |

### 搜尋列（SearchBar）

- 輸入關鍵字時，以 300ms debounce 呼叫 Google Places Autocomplete API 顯示建議。
- 以使用者目前位置為中心偏差來排序建議結果（`locationBias` 半徑 5km）。
- 已登入使用者可查看/清除最近 10 筆搜尋紀錄。

### 路線規劃（RoutePanel）

- 支援三種模式：大眾運輸、步行、輪椅路線。
- 輪椅模式選擇大眾運輸並加入 `avoid=indoor` 參數減少室內路段（降低階梯機率）。
- 距離/時間即時顯示，可展開逐步導航指令。
- **語音導航功能**：使用 Web Speech API（`zh-TW`），以 Geolocation watchPosition 追蹤目前位置，接近下一步驟時自動朗讀指令。

### 地點詳情側邊欄（PlaceSidebar）

- 展示地點名稱、地址、Google 評分及無障礙选项（輪椅入口、停車、廁所、座位）。
- **無障礙評分系統**：使用者可對無障礙入口、廁所、停車、坡道四個面向進行 `YES / LIMITED / NO / UNKNOWN` 評分並留言，資料儲存至 PostgreSQL。
- **收藏功能**：已登入使用者可收藏/取消收藏地點。

### 使用者認證（UserButton）

- Google OAuth 2.0 登入（`@react-oauth/google`），取得使用者 Google 帳號頭像與資訊。
- 登入狀態透過 Zustand `persist` 儲存於 localStorage，重新整理後自動恢復。

### 定位按鈕（LocateButton）

- 點擊後呼叫 `navigator.geolocation.getCurrentPosition`（高精度），定位成功後移動地圖至目前位置並縮放至 z16。

---

## API 端點

### 後端（Express）

| 方法 | 路徑 | 說明 |
|------|------|------|
| `GET` | `/api/health` | 健康確認 |
| `GET` | `/api/places` | Google Places 搜尋代理（`lat`, `lng`, `type`, `radius`, `keyword`） |
| `GET` | `/api/places/photo` | Google 地點照片代理（避免在前端暴露 API Key） |
| `GET` | `/api/disability-map` | data.taipei 身障資源點（1 小時快取） |
| `GET` | `/api/directions` | Google Directions 路線代理（`origin`, `destination`, `mode`） |
| `GET` | `/api/ratings/:googlePlaceId` | 取得地點無障礙評分 |
| `POST` | `/api/ratings` | 新增無障礙評分 |
| `PATCH` | `/api/ratings/:id` | 更新自己的無障礙評分（需 `submitterGoogleId` 驗證） |
| `GET` | `/api/bookmarks?userId=` | 取得使用者收藏清單 |
| `POST` | `/api/bookmarks` | 新增收藏 |
| `DELETE` | `/api/bookmarks/:googlePlaceId?userId=` | 刪除收藏 |
| `GET` | `/api/search-history?userId=` | 取得最近搜尋紀錄（最多 10 筆，去重） |
| `POST` | `/api/search-history` | 新增搜尋紀錄 |
| `DELETE` | `/api/search-history?userId=` | 清除全部搜尋紀錄 |

---

## 資料庫 Schema

```
User           ← Google OAuth 使用者資料
Bookmark       ← 使用者收藏的地點（userId + googlePlaceId 唯一）
SearchHistory  ← 搜尋紀錄
Place          ← 地點資料（透過 googlePlaceId 對應）
Rating         ← 無障礙評分（ramp / toilet / parking / entrance）
Photo          ← 地點照片（預留）
```

`Rating` 的每個無障礙面向使用 enum `AccessibilityLevel`：`YES | LIMITED | NO | UNKNOWN`。

---

## 外部資料來源

| 來源 | 說明 |
|------|------|
| [Google Places API (New)](https://developers.google.com/maps/documentation/places/web-service) | 地點搜尋、Autocomplete、無障礙選項欄位 |
| [Google Directions API](https://developers.google.com/maps/documentation/directions) | 路線規劃、逐步指令 |
| [data.taipei](https://data.taipei/) | 台北市無障礙廁所及坡道資料集 |

---

## 部署

- **前端**：推送至 GitHub 後 Vercel 自動部署，需設定 `VITE_*` 環境變數。
- **後端**：Render 連接 GitHub 自動部署，需設定 `DATABASE_URL`、`GOOGLE_MAPS_API_KEY`、`CLIENT_URL`。
- **資料庫**：Supabase（PostgreSQL），透過 `prisma db push` 同步 schema。
