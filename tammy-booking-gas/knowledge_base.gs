const STUDIO_INFO = {
  name: '甜蜜事務所 (Tammy’s Studio)',
  address: '台中市南區忠明南路 1276 號 5 樓',
  contact: '無電話提供，請直接於 LINE 聯繫。',
  businessHours: '09:00 - 20:30（最後一位預約時間）',
  transportation: {
    bus: '58 號公車站牌',
    car: '忠明南路或祥興路路邊停車，或停至祥興路汽車停車場',
    scooter: '旁邊巷子格位內',
  },
};

const SERVICE_CATALOG = {
  privateParts: [
    { name: '巴西式全除', price: 2600, promo: '新客體驗價 $2,000' },
    { name: '比基尼除毛', price: 2000 },
    { name: '特殊造型', price: 3000 },
    { name: '私密嫩白護理', price: 1880, addon: '私密敷膜 $500' },
    { name: '孕媽咪甜心方案', price: 3500, originalPrice: 4680, recommended: true },
  ],
  limb: [
    { name: '全手', price: 1600 },
    { name: '前臂', price: 1200 },
    { name: '全腿', price: 2200 },
    { name: '小腿', price: 1500 },
  ],
  others: [
    { name: '腋下', price: 800, addon: '全除加購價 $400' },
    { name: '手背', price: 400 },
    { name: '腳背', price: 400 },
    { name: '手指', price: 400 },
    { name: '腳趾', price: 400 },
    { name: '小鬍子', price: 600 },
    { name: '眉毛', price: 600 },
    { name: '上腹', price: 600 },
    { name: '下腹', price: 600 },
  ],
  promotions: ['60 天內回除 8 折', '半年內回除 85 折'],
};

const PREGNANCY_GUIDE = {
  reasons: [
    '懷孕期間體溫上升與分泌物增加，除毛可減少悶熱、異味與感染風險。',
    '孕肚變大後清潔較不方便，除毛有助於維持私密處清潔。',
    '熱蠟除毛後新生毛髮較細軟，可降低生產前後刮毛造成的不適。',
  ],
  timeline: {
    first: '滿 15 週以上且胎象穩定即可開始。',
    maintenance: '建議於 26-27 週、32-33 週各保養一次。',
    beforeBirth: {
      natural: '自然產建議預產期前 10-14 天。',
      cSection: '剖腹產建議醫師約定日前 5-7 天。',
    },
  },
};

const BOOKING_POLICY = {
  interval: '兩次除毛建議間隔超過 1 個月。',
  cancellation: '如需取消請至少於 3 天前告知。',
  onsite: ['禁止攜帶寵物', '可攜伴（同空間，不介意即可）'],
  aftercare: '當天請穿著寬鬆、避免悶熱與過度摩擦，以加速退紅。',
};
