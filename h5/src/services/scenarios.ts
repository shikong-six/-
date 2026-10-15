// 场景化首页：四大咨询场景 + 预置问题（前端预置，一键发问）

export interface Scenario {
  key: string;
  title: string;
  icon: string;
  accent: string;      // 小色条 / 图标色（不再整卡铺满大色块）
  description: string;
  questions: string[];
}

export const scenarios: Scenario[] = [
  {
    key: 'labor',
    title: '劳动纠纷',
    icon: 'user-o',
    accent: '#0f9d8f',
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
    accent: '#07c160',
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
    accent: '#e64980',
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
    icon: 'warning-o',
    accent: '#f2994a',
    description: '赔偿、误工费、逃逸责任',
    questions: [
      '交通事故误工费怎么算？',
      '被车撞了对方全责怎么索赔？',
      '肇事逃逸导致责任加重怎么认定？',
    ],
  },
];
