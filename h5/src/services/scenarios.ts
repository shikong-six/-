// 场景化首页数据：四大法律咨询场景 + 每个场景预置的具体问题
// 前端预置（与 Web 端热门问题同一思路），点击问题自动发问，不需要后端接口

export interface Scenario {
  key: string;
  title: string;        // 场景名
  icon: string;         // Vant 内置图标名
  color: string;        // 卡片主色
  description: string;  // 一句话说明
  questions: string[];  // 预置问题清单
}

export const scenarios: Scenario[] = [
  {
    key: 'labor',
    title: '劳动纠纷',
    icon: 'user-o',
    color: '#4a6cf7',
    description: '欠薪、辞退、加班费、不签合同',
    questions: [
      '经济补偿金怎么算？',
      '公司不签劳动合同怎么办？',
      '试用期被辞退有赔偿吗？',
      '加班费怎么计算？',
    ],
  },
  {
    key: 'rent',
    title: '租房住房',
    icon: 'home-o',
    color: '#07c160',
    description: '押金、退租、房东违约',
    questions: [
      '房东不退押金怎么办？',
      '租房合同没到期能提前退租吗？',
      '房东随便涨房租合法吗？',
    ],
  },
  {
    key: 'marriage',
    title: '婚姻家事',
    icon: 'like-o',
    color: '#ee0a24',
    description: '离婚、财产、抚养',
    questions: [
      '协议离婚需要什么材料和流程？',
      '离婚时彩礼能要回来吗？',
      '孩子的抚养权怎么判？',
    ],
  },
  {
    key: 'traffic',
    title: '交通事故',
    icon: 'logistics',
    color: '#ff976a',
    description: '赔偿、误工费、责任认定',
    questions: [
      '交通事故误工费怎么算？',
      '被车撞了对方全责怎么索赔？',
      '交通事故责任怎么划分？',
    ],
  },
];
