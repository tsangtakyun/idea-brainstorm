export type CampaignStatus =
  | 'submitted'
  | 'brief_review'
  | 'matching'
  | 'creator_pending'
  | 'in_production'
  | 'delivered'
  | 'closed'

export type MatchStatus = 'suggested' | 'invited' | 'accepted' | 'declined'

export type DeliverableStatus = 'draft_uploaded' | 'under_review' | 'approved'

export type CreatorProfile = {
  id: string
  displayName: string
  baseCity: string
  niches: string[]
  platforms: string[]
  minRate: number
  styleSummary: string
  portfolioLabel: string
}

export type CampaignMatch = {
  id: string
  creatorId: string
  matchScore: number
  matchReason: string
  status: MatchStatus
  agreedRate?: number
}

export type Deliverable = {
  id: string
  label: string
  status: DeliverableStatus
  dueText: string
}

export type Campaign = {
  id: string
  title: string
  merchantName: string
  vertical: 'food' | 'travel' | 'product' | 'experience'
  objective: string
  budgetRange: string
  locationText: string
  deadlineText: string
  status: CampaignStatus
  sourceChannel: string
  aiSummary: string
  targetPlatforms: string[]
  keySellingPoints: string[]
  mustInclude: string[]
  angleSuggestions: string[]
  productionNotes: string[]
  matches: CampaignMatch[]
  deliverables: Deliverable[]
}

export const creators: CreatorProfile[] = [
  {
    id: 'creator_onebite_amy',
    displayName: 'Amy Chow',
    baseCity: 'Hong Kong',
    niches: ['food', 'cafe', 'lifestyle'],
    platforms: ['Instagram Reels', 'TikTok'],
    minRate: 2800,
    styleSummary: '反應自然，節奏快，擅長食物第一口 reaction 同餐廳 narrative。',
    portfolioLabel: 'One Bite style creator',
  },
  {
    id: 'creator_foundhere_kai',
    displayName: 'Kai Wong',
    baseCity: 'Hong Kong',
    niches: ['travel', 'city walk', 'hidden gems'],
    platforms: ['Instagram Reels', 'YouTube Shorts'],
    minRate: 3200,
    styleSummary: '擅長地方感、路線感同 scene reveal，適合旅遊體驗同城市探索。',
    portfolioLabel: 'Found Here style creator',
  },
  {
    id: 'creator_picked_mina',
    displayName: 'Mina Lee',
    baseCity: 'Hong Kong',
    niches: ['product', 'beauty', 'good finds'],
    platforms: ['Instagram Reels', 'Xiaohongshu'],
    minRate: 3500,
    styleSummary: '產品 presentation 清楚，開箱節奏好，適合 Picked 帶貨內容。',
    portfolioLabel: 'Picked style creator',
  },
]

export const campaigns: Campaign[] = [
  {
    id: 'camp_onebite_tst_noodle',
    title: 'One Bite: TST 新派麵店開幕推廣',
    merchantName: 'Noodle Social Club',
    vertical: 'food',
    objective: '幫新店開幕兩星期內拉第一輪到店流量，重點突出招牌湯底同夜晚氛圍。',
    budgetRange: 'HK$8,000 - HK$12,000',
    locationText: '尖沙咀',
    deadlineText: '2026-04-16',
    status: 'matching',
    sourceChannel: 'One Bite inbound',
    aiSummary: '商戶想用一條主 Reel + 一條補充 food cut，目標受眾係會為夜晚聚餐同打卡氛圍買單嘅 20-35 歲香港觀眾。',
    targetPlatforms: ['Instagram Reels'],
    keySellingPoints: ['手工麵', '濃雞湯底', '夜晚霓虹內裝'],
    mustInclude: ['店舖位置', '開幕限定優惠', '招牌湯底 close-up'],
    angleSuggestions: [
      '由「呢間新店夜晚氣氛值唔值得專程去」切入',
      '用第一口湯底 reaction 帶出記憶點',
      '以尖沙咀夜食好去處做城市情境包裝',
    ],
    productionNotes: [
      '適合 One Bite creator，以食物 reaction 做主線',
      '鏡頭要兼顧內裝 atmosphere，同時保留湯底特寫',
      '第一版 script 可直接接 script-generator food workflow',
    ],
    matches: [
      {
        id: 'match_noodle_amy',
        creatorId: 'creator_onebite_amy',
        matchScore: 92,
        matchReason: '食物 reaction 強，預算 fit，作品節奏啱開幕型餐飲 campaign。',
        status: 'suggested',
      },
      {
        id: 'match_noodle_kai',
        creatorId: 'creator_foundhere_kai',
        matchScore: 78,
        matchReason: '地區感同街景交代好，適合做次選版本。',
        status: 'suggested',
      },
    ],
    deliverables: [
      { id: 'del_1', label: 'Main Reel', status: 'draft_uploaded', dueText: 'Draft due 2026-04-14' },
      { id: 'del_2', label: 'Food cutdown', status: 'under_review', dueText: 'Draft due 2026-04-15' },
    ],
  },
  {
    id: 'camp_foundhere_lamma_walk',
    title: 'Found Here: 南丫島慢遊體驗合作',
    merchantName: 'Harbour Trail Experience',
    vertical: 'travel',
    objective: '幫本地慢遊體驗 package 吸引週末情侶同外地旅客查詢。',
    budgetRange: 'HK$15,000 - HK$22,000',
    locationText: '南丫島',
    deadlineText: '2026-04-22',
    status: 'creator_pending',
    sourceChannel: 'Found Here outbound',
    aiSummary: '旅遊體驗商戶想要一條帶路線感嘅內容，唔係 hard sell，而係由「香港仲有呢種半日逃離感」做敘事。',
    targetPlatforms: ['Instagram Reels', 'YouTube Shorts'],
    keySellingPoints: ['海景路線', '本地導賞', '半日逃離城市'],
    mustInclude: ['集合地點', '行程時長', '預約方式'],
    angleSuggestions: [
      '用「離市區一個鐘就去到另一個世界」做 hook',
      '先俾環境感，再慢慢 reveal 體驗內容',
      '旅遊內容適合接 storyboard transition / ending 指引',
    ],
    productionNotes: [
      '更適合 Found Here style creator',
      '可以 later 接 soon-video-generator 做 visual preview',
    ],
    matches: [
      {
        id: 'match_lamma_kai',
        creatorId: 'creator_foundhere_kai',
        matchScore: 95,
        matchReason: '作品中地方感同 walking reveal 非常貼近 Found Here 需要。',
        status: 'invited',
        agreedRate: 4800,
      },
    ],
    deliverables: [
      { id: 'del_3', label: 'Main Reel', status: 'under_review', dueText: 'Draft due 2026-04-20' },
    ],
  },
  {
    id: 'camp_picked_lamp',
    title: 'Picked: 北歐木系枱燈帶貨測試',
    merchantName: 'Picked',
    vertical: 'product',
    objective: '試驗內容帶貨轉化，測試唔同 creator 對同一產品嘅 commission potential。',
    budgetRange: 'HK$10,000 - HK$18,000',
    locationText: 'Online / Hong Kong',
    deadlineText: '2026-04-25',
    status: 'brief_review',
    sourceChannel: 'Picked internal',
    aiSummary: '呢個 campaign 除咗賣產品，仲要為將來 content-to-commerce attribution 做試驗，所以 tracking 同不同 angle 對照都重要。',
    targetPlatforms: ['Instagram Reels', 'Xiaohongshu'],
    keySellingPoints: ['木系設計', '暖光氣氛', '細空間友好'],
    mustInclude: ['價格', '尺寸感', '購買連結 CTA'],
    angleSuggestions: [
      '用「細房間加一盞燈個 mood 即刻唔同」去切入',
      '一條偏情境，一條偏實用比較',
      '可作未來 Picked commission engine 範例 campaign',
    ],
    productionNotes: [
      '第一版可以只做 campaign workspace，不急住做 checkout',
      '之後可接 product attribution 同 creator commission logic',
    ],
    matches: [
      {
        id: 'match_lamp_mina',
        creatorId: 'creator_picked_mina',
        matchScore: 91,
        matchReason: '產品展示力高，而且觀眾對室內生活用品接受度高。',
        status: 'suggested',
      },
    ],
    deliverables: [
      { id: 'del_4', label: 'UGC-style Reel', status: 'draft_uploaded', dueText: 'Draft due 2026-04-23' },
    ],
  },
]

export function getCampaignById(id: string) {
  return campaigns.find((campaign) => campaign.id === id)
}

export function getCreatorById(id: string) {
  return creators.find((creator) => creator.id === id)
}

export const statusMeta: Record<CampaignStatus, { label: string; tone: string }> = {
  submitted: { label: 'Submitted', tone: '#7d6c56' },
  brief_review: { label: 'Brief Review', tone: '#856404' },
  matching: { label: 'Matching', tone: '#6c5b39' },
  creator_pending: { label: 'Creator Pending', tone: '#5b5f97' },
  in_production: { label: 'In Production', tone: '#2d6a4f' },
  delivered: { label: 'Delivered', tone: '#1d3557' },
  closed: { label: 'Closed', tone: '#6b705c' },
}
