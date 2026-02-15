# 智能终端现代化 UI/UX 优化计划

## 目标
将 DXC 游戏中的“智能终端”模块改造为符合现代化移动端 App（如微信、Discord、小红书）使用习惯的界面。

## 核心设计理念
1.  **Bottom Navigation (底部导航)**: 主导航移至底部，符合拇指操作热区。
2.  **Stack Navigation (栈式导航)**: 明确“层级”概念，子页面（如聊天详情、帖子详情）覆盖主页面，并支持返回。
3.  **Feed-First (流式优先)**: 论坛和朋友圈采用沉浸式卡片流设计。
4.  **Touch-Friendly (触控友好)**: 增大点击区域，优化输入框体验。

## 模块拆解与重构

### 1. 导航结构 (Navigation Structure)
目前结构：`Top Tabs` -> `Content`
目标结构：
```tsx
<PhoneContainer>
  <StatusBar /> (顶部：时间、信号、电量)
  <MainContent> (中间滚动区域)
    <TabContent /> or <SubPageOverlay />
  </MainContent>
  <BottomTabBar /> (底部：仅在主Tab页显示)
</PhoneContainer>
```

### 2. Tab 重新规划
| 旧 Tab | 新 Tab (底部图标) | 对应现代 App 模块 |
| :--- | :--- | :--- |
| COMM (概览) | **首页 (Home)** | 聚合页/Dashboard |
| CHAT (消息) | **消息 (Chats)** | 微信/Discord 列表 |
| CONTACTS (联系人) | **通讯录 (Contacts)** | 通讯录 |
| MOMENTS (动态) | **发现 (Discover)** | 朋友圈 + 论坛入口 |
| PARTY/FAMILIA | **我的 (Profile)** | 个人中心/队伍/公会 |

### 3. 具体页面优化方案

#### A. 消息 (Chats)
- **列表页**: 头像圆角矩形，未读红点，最后一条消息预览（灰色）。
- **详情页**:
  - 气泡式对话（左侧对方，右侧自己）。
  - 输入框支持 `TextareaAutosize`。
  - 顶部标题栏显示对方状态（在线/离线）。

#### B. 论坛 (Forum) - 参考小红书/贴吧
- **布局**: 双列瀑布流（如果图片多）或 单列大卡片（如果文字多）。
- **交互**: 列表页直接点赞。点击卡片进入详情。
- **发帖**: 悬浮 FAB (Floating Action Button) 或 顶部右上角 "+" 号。

#### C. 通讯录 (Contacts)
- **分组**: 顶部保留“特别关注”、“周围的人”作为快速筛选胶囊（Chips）。
- **列表**: 增加右侧索引条（A-Z，如果支持的话，目前可能不需要）。

### 4. 技术实现路径

#### Step 1: 组件拆分
将 `SocialPhoneModal.tsx` 里的巨型组件拆分为：
- `components/game/phone/PhoneShell.tsx` (容器)
- `components/game/phone/BottomTabBar.tsx`
- `components/game/phone/views/ChatListView.tsx`
- `components/game/phone/views/ChatDetailView.tsx`
- `components/game/phone/views/ForumFeedView.tsx`

#### Step 2: 样式重写
- 使用 Tailwind 的 `pb-safe` 确保底部导航不被 iPhone横条遮挡。
- 使用 `sticky top-0` 做沉浸式 Header。

#### Step 3: 动效添加
- 使用 `framer-motion` 实现 Tab 切换的 `opacity` 动画。
- 子页面进入使用 `x: "100%"` -> `x: 0` 的滑入动画。

## 后续建议
- **键盘避让**: 移动端 WebApp 最头痛的问题。需要监听 `window.visualViewport` 来动态调整高度。
