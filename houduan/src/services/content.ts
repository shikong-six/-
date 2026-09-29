// 内容库服务：法律案例 + 法律条文（MySQL 存储）
// 启动时自动建表，空库自动灌入种子数据（内容原在前端 mock，现入库统一管理）
import pool from './db';

// ===== 类型（与前端 services/content.ts 对齐）=====
export interface LawCase {
  id: number;
  category: string;    // 分类路由段：marriage/traffic/...
  title: string;
  summary: string;
  verdict: string;
  lawRefs: string[];   // 相关法条（库里以 JSON 字符串存，读出时解析）
}

export interface LawArticle {
  id: number;
  category: string;
  title: string;
  source: string;
  content: string;
}

// ===== 种子数据：法律案例（6 个分类 18 条）=====
const seedCases: LawCase[] = [
  // 婚姻家庭
  {id: 1, category: 'marriage', title: '离婚后物价上涨，一方请求增加子女抚养费获支持', summary: '夫妻双方协议离婚，约定孩子由母亲抚养，父亲每月支付抚养费 2000 元。三年后孩子进入初中，教育和生活支出明显增加，母亲起诉请求将抚养费增加至 3500 元。', verdict: '法院认为，原定抚养费已不足以维持当地实际生活水平，结合父亲收入情况，判决增加至每月 3200 元。', lawRefs: ['《民法典》第1085条', '最高法婚姻家庭编解释（一）第58条']},
  {id: 2, category: 'marriage', title: '婚前一方首付购房，婚后共同还贷的离婚分割', summary: '男方婚前首付购买房产并登记在自己名下，婚后夫妻共同还贷。离婚时女方主张分割房屋增值部分。', verdict: '法院判决房屋归男方所有，尚未归还的贷款为男方个人债务；男方需就婚后共同还贷部分及其增值向女方补偿。', lawRefs: ['《民法典》第1062条', '婚姻家庭编解释（一）第78条']},
  {id: 3, category: 'marriage', title: '家暴离婚并主张损害赔偿获支持', summary: '女方长期遭受男方家庭暴力并留有报警记录、伤情鉴定，起诉离婚同时主张损害赔偿 10 万元。', verdict: '法院认定家暴事实成立，判决准予离婚，并支持损害赔偿 8 万元。', lawRefs: ['《民法典》第1079条', '《民法典》第1091条']},
  // 交通事故
  {id: 4, category: 'traffic', title: '追尾事故全责方的赔偿范围认定', summary: '后车追尾前车，交警认定后车全责。前车车主除修车费外，还主张修车期间的替代交通费用。', verdict: '法院判决全责方赔偿车辆维修费及合理的替代交通费用；折旧损失因缺乏依据未获支持。', lawRefs: ['《道路交通安全法》第76条', '《民法典》第1184条']},
  {id: 5, category: 'traffic', title: '醉驾电动车与机动车相撞的责任划分', summary: '醉酒驾驶电动自行车的一方与正常行驶的小客车相撞，双方对责任认定有争议。', verdict: '法院认定电动车一方醉酒驾驶存在重大过错，适当减轻机动车一方责任，按 7:3 划分赔偿比例。', lawRefs: ['《道路交通安全法》第76条']},
  {id: 6, category: 'traffic', title: '保险公司交强险先行赔付的适用', summary: '肇事方未购买商业三者险，受害人直接起诉要求保险公司在交强险限额内先行赔付。', verdict: '法院判决保险公司在交强险责任限额内先行赔付，不足部分由肇事方按责任比例承担。', lawRefs: ['《交强险条例》第21条']},
  // 合同纠纷
  {id: 7, category: 'contract', title: '约定违约金过高，法院依法调低', summary: '合同约定逾期交房每日按总价款千分之三支付违约金，开发商逾期三个月，购房者起诉索赔 27 万元。', verdict: '法院认为约定违约金明显高于实际损失，兼顾合同履行情况，酌情调至按同期 LPR 的 1.3 倍计算。', lawRefs: ['《民法典》第585条']},
  {id: 8, category: 'contract', title: '格式条款未尽提示义务不成为合同内容', summary: '消费者在 App 注册时被默认勾选"一切争议由平台所在地法院管辖"，后因纠纷在自己所在地起诉。', verdict: '法院认为平台未尽显著提示说明义务，该管辖格式条款不成为合同内容，案件由消费者所在地法院管辖。', lawRefs: ['《民法典》第496条', '《民法典》第497条']},
  {id: 9, category: 'contract', title: '卖方逾期交付货物，买方解除合同并索赔', summary: '买方支付全款后，卖方迟延交付设备超过合同约定的解除宽限期。', verdict: '法院判决解除合同，卖方返还货款并赔偿买方因此遭受的直接损失。', lawRefs: ['《民法典》第563条', '《民法典》第577条']},
  // 劳动纠纷
  {id: 10, category: 'labor', title: '未签书面劳动合同的二倍工资差额', summary: '员工入职公司 8 个月，公司一直未与其签订书面劳动合同，员工离职后主张二倍工资差额。', verdict: '法院支持入职满一个月起至离职止的二倍工资差额（扣除已发工资）。', lawRefs: ['《劳动合同法》第82条']},
  {id: 11, category: 'labor', title: '违法解除劳动合同的赔偿金', summary: '公司以"业绩不达标"为由直接辞退员工，未提前通知也未支付经济补偿。', verdict: '法院认定解除违法，判决公司按经济补偿标准的二倍支付赔偿金。', lawRefs: ['《劳动合同法》第47条', '《劳动合同法》第87条']},
  {id: 12, category: 'labor', title: '加班费的计算基数与举证责任', summary: '员工主张两年加班费，公司否认存在加班，员工提交了考勤打卡记录和加班审批邮件。', verdict: '法院依据员工举证认定加班事实，按劳动合同约定的工资基数计算加班费。', lawRefs: ['《劳动合同法》第31条', '《工资支付暂行规定》第13条']},
  // 房产物业
  {id: 13, category: 'property', title: '租赁合同到期，房东无故扣留押金', summary: '租客按约腾退房屋并结清费用，房东以"墙面有正常居住损耗"为由拒退 4000 元押金。', verdict: '法院认定正常损耗不属于租客赔偿范围，判决房东全额退还押金并支付逾期利息。', lawRefs: ['《民法典》第710条', '《民法典》第733条']},
  {id: 14, category: 'property', title: '空置房是否减免物业费', summary: '业主房屋空置两年未入住，拒缴物业费，物业起诉。', verdict: '法院认为物业服务面向公共区域，空置不免除缴费义务；部分地区可依地方规定协商减收。', lawRefs: ['《民法典》第944条']},
  {id: 15, category: 'property', title: '一房二卖，后买受人过户在先的效力', summary: '卖方先后与两人签订房屋买卖合同，后买受人已完成过户登记。', verdict: '法院认定后买受人取得房屋所有权，前买受人可主张解除合同并要求卖方承担违约赔偿。', lawRefs: ['《民法典》第209条', '《民法典》第215条']},
  // 刑事辩护
  {id: 16, category: 'criminal', title: '危险驾驶罪适用缓刑的情形', summary: '被告人血液酒精含量 120mg/100ml，未造成事故，认罪认罚，主张适用缓刑。', verdict: '法院综合考虑酒精含量较低、无从重情节、认罪认罚，判处拘役二个月，缓刑三个月。', lawRefs: ['《刑法》第133条之一', '《刑事诉讼法》第15条']},
  {id: 17, category: 'criminal', title: '故意伤害与正当防卫的界限', summary: '双方因琐事发生冲突，一方持械先动手，另一方还手致对方轻伤。', verdict: '法院认定还手一方系制止不法侵害，属正当防卫，不负刑事责任。', lawRefs: ['《刑法》第20条']},
  {id: 18, category: 'criminal', title: '帮助信息网络犯罪活动罪的从轻情节', summary: '在校大学生出借银行卡给他人用于转账，涉案流水较大，但获利极少且系初犯。', verdict: '法院认定构成帮信罪，综合从犯地位、坦白、退赃等情节，判处缓刑并处罚金。', lawRefs: ['《刑法》第287条之二']},
];

// ===== 种子数据：法律条文（6 个模块 21 条，常用法条精简摘录，非官方文本）=====
const seedArticles: LawArticle[] = [
  // 婚姻家庭
  {id: 1, category: 'marriage', title: '诉讼离婚的准予条件', source: '《民法典》第1079条', content: '人民法院审理离婚案件，应当进行调解；如果感情确已破裂，调解无效的，应当准予离婚。重婚或与他人同居、实施家庭暴力、赌博吸毒屡教不改、因感情不和分居满二年等情形，调解无效的，应当准予离婚。'},
  {id: 2, category: 'marriage', title: '离婚后子女抚养费的负担', source: '《民法典》第1085条', content: '离婚后，子女由一方直接抚养的，另一方应当负担部分或者全部抚养费。费用的多少和期限的长短，由双方协议；协议不成的，由人民法院判决。子女在必要时有权向父母任何一方提出超过协议或判决原定数额的合理要求。'},
  {id: 3, category: 'marriage', title: '离婚损害赔偿', source: '《民法典》第1091条', content: '因重婚、与他人同居、实施家庭暴力、虐待或遗弃家庭成员，以及有其他重大过错导致离婚的，无过错方有权请求损害赔偿。'},
  // 交通事故
  {id: 4, category: 'traffic', title: '交通事故的赔偿责任划分', source: '《道路交通安全法》第76条', content: '机动车发生交通事故造成人身伤亡、财产损失的，由保险公司在机动车第三者责任强制保险责任限额范围内予以赔偿；不足的部分，机动车之间发生交通事故的，由有过错的一方承担赔偿责任，双方都有过错的，按照各自过错的比例分担。'},
  {id: 5, category: 'traffic', title: '人身损害赔偿范围', source: '《民法典》第1179条', content: '侵害他人造成人身损害的，应当赔偿医疗费、护理费、交通费、营养费、住院伙食补助费等为治疗和康复支出的合理费用，以及因误工减少的收入。造成残疾的，还应赔偿辅助器具费和残疾赔偿金；造成死亡的，还应赔偿丧葬费和死亡赔偿金。'},
  {id: 6, category: 'traffic', title: '赔偿顺序：交强险 → 商业险 → 侵权人', source: '《民法典》第1213条', content: '机动车发生交通事故造成损害，属于该机动车一方责任的，先由承保机动车强制保险的保险人在强制保险责任限额范围内予以赔偿；不足部分，由承保机动车商业保险的保险人按照保险合同的约定予以赔偿；仍然不足或者未投保商业保险的，由侵权人赔偿。'},
  // 合同纠纷
  {id: 7, category: 'contract', title: '依法成立合同的效力', source: '《民法典》第465条', content: '依法成立的合同，受法律保护。依法成立的合同，仅对当事人具有法律约束力，但是法律另有规定的除外。'},
  {id: 8, category: 'contract', title: '格式条款的提示义务与无效情形', source: '《民法典》第496、497条', content: '提供格式条款的一方未履行提示或者说明义务，致使对方没有注意或者理解与其有重大利害关系的条款的，对方可以主张该条款不成为合同内容。不合理地免除或者减轻其责任、加重对方责任、限制对方主要权利，或排除对方主要权利的格式条款无效。'},
  {id: 9, category: 'contract', title: '违约责任的承担方式', source: '《民法典》第577条', content: '当事人一方不履行合同义务或者履行合同义务不符合约定的，应当承担继续履行、采取补救措施或者赔偿损失等违约责任。'},
  {id: 10, category: 'contract', title: '违约金的调整', source: '《民法典》第585条', content: '约定的违约金低于造成的损失的，人民法院或者仲裁机构可以根据当事人的请求予以增加；约定的违约金过分高于造成的损失的，可以根据当事人的请求予以适当减少。'},
  // 劳动纠纷
  {id: 11, category: 'labor', title: '书面劳动合同的订立时限', source: '《劳动合同法》第10条', content: '建立劳动关系，应当订立书面劳动合同。已建立劳动关系，未同时订立书面劳动合同的，应当自用工之日起一个月内订立书面劳动合同。'},
  {id: 12, category: 'labor', title: '加班费的支付', source: '《劳动合同法》第31条', content: '用人单位应当严格执行劳动定额标准，不得强迫或者变相强迫劳动者加班。用人单位安排加班的，应当按照国家有关规定向劳动者支付加班费。'},
  {id: 13, category: 'labor', title: '经济补偿的计算标准', source: '《劳动合同法》第47条', content: '经济补偿按劳动者在本单位工作的年限，每满一年支付一个月工资的标准向劳动者支付。六个月以上不满一年的，按一年计算；不满六个月的，支付半个月工资的经济补偿。'},
  {id: 14, category: 'labor', title: '未签书面劳动合同的二倍工资', source: '《劳动合同法》第82条', content: '用人单位自用工之日起超过一个月不满一年未与劳动者订立书面劳动合同的，应当向劳动者每月支付二倍的工资。用人单位违反本法规定不与劳动者订立无固定期限劳动合同的，自应当订立之日起向劳动者每月支付二倍的工资。'},
  {id: 15, category: 'labor', title: '违法解除的赔偿金', source: '《劳动合同法》第87条', content: '用人单位违反本法规定解除或者终止劳动合同的，应当依照本法第四十七条规定的经济补偿标准的二倍向劳动者支付赔偿金。'},
  // 房产物业
  {id: 16, category: 'property', title: '租赁合同的定义', source: '《民法典》第703条', content: '租赁合同是出租人将租赁物交付承租人使用、收益，承租人支付租金的合同。租赁期限不得超过二十年；超过二十年的，超过部分无效。'},
  {id: 17, category: 'property', title: '正常损耗不赔', source: '《民法典》第710条', content: '承租人按照约定的方法或者根据租赁物的性质使用租赁物，致使租赁物受到损耗的，不承担赔偿责任。'},
  {id: 18, category: 'property', title: '业主支付物业费的义务', source: '《民法典》第944条', content: '业主应当按照约定向物业服务人支付物业费。物业服务人已经按照约定和有关规定提供服务的，业主不得以未接受或者无需接受相关物业服务为由拒绝支付物业费。业主逾期不支付的，物业服务人可以催告其在合理期限内支付，也可以依法提起诉讼或申请仲裁。'},
  // 刑事辩护
  {id: 19, category: 'criminal', title: '正当防卫', source: '《刑法》第20条', content: '为使国家、公共利益、本人或者他人的人身、财产和其他权利免受正在进行的不法侵害，而采取的制止不法侵害的行为，对不法侵害人造成损害的，属于正当防卫，不负刑事责任。正当防卫明显超过必要限度造成重大损害的，应当负刑事责任，但是应当减轻或者免除处罚。'},
  {id: 20, category: 'criminal', title: '危险驾驶罪', source: '《刑法》第133条之一', content: '在道路上驾驶机动车，追逐竞驶情节恶劣的，醉酒驾驶机动车的，从事校车业务或者旅客运输严重超过额定乘员载客或严重超过规定时速行驶的，以及违反危险化学品安全管理规定运输危险化学品危及公共安全的，处拘役，并处罚金。'},
  {id: 21, category: 'criminal', title: '帮助信息网络犯罪活动罪', source: '《刑法》第287条之二', content: '明知他人利用信息网络实施犯罪，为其犯罪提供互联网接入、服务器托管、网络存储、通讯传输等技术支持，或者提供广告推广、支付结算等帮助，情节严重的，处三年以下有期徒刑或者拘役，并处或者单处罚金。'},
];

// ===== 建表 + 空库灌种子数据（幂等：可重复执行）=====
async function initContentTables(): Promise<void> {
  // 法律案例表
  await pool.query(`
    CREATE TABLE IF NOT EXISTS law_cases (
      id INT AUTO_INCREMENT PRIMARY KEY COMMENT '自增ID',
      category VARCHAR(32) NOT NULL COMMENT '分类路由段：marriage/traffic/contract/labor/property/criminal',
      title VARCHAR(255) NOT NULL COMMENT '案例标题',
      summary TEXT COMMENT '案情摘要',
      verdict TEXT COMMENT '裁判要旨',
      law_refs VARCHAR(500) COMMENT '相关法条（JSON 数组字符串）',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '入库时间',
      INDEX idx_category (category)
    ) COMMENT='法律案例库'
  `);
  // 法律条文表
  await pool.query(`
    CREATE TABLE IF NOT EXISTS law_articles (
      id INT AUTO_INCREMENT PRIMARY KEY COMMENT '自增ID',
      category VARCHAR(32) NOT NULL COMMENT '模块路由段',
      title VARCHAR(255) NOT NULL COMMENT '条文要点名',
      source VARCHAR(128) COMMENT '出处（法律+条号）',
      content TEXT COMMENT '条文内容（精简摘录）',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '入库时间',
      INDEX idx_category (category)
    ) COMMENT='法律条文库'
  `);
  // 空库才灌种子数据，避免重复插入
  const [caseRows] = await pool.query<any[]>('SELECT COUNT(*) AS total FROM law_cases');
  if (caseRows[0].total === 0) {
    for (const item of seedCases) {
      await pool.query(
        'INSERT INTO law_cases (id, category, title, summary, verdict, law_refs) VALUES (?,?,?,?,?,?)',
        [item.id, item.category, item.title, item.summary, item.verdict, JSON.stringify(item.lawRefs)]
      );
    }
    console.log(`法律案例种子数据已写入：${seedCases.length} 条`);
  }
  const [articleRows] = await pool.query<any[]>('SELECT COUNT(*) AS total FROM law_articles');
  if (articleRows[0].total === 0) {
    for (const item of seedArticles) {
      await pool.query(
        'INSERT INTO law_articles (id, category, title, source, content) VALUES (?,?,?,?,?)',
        [item.id, item.category, item.title, item.source, item.content]
      );
    }
    console.log(`法律条文种子数据已写入：${seedArticles.length} 条`);
  }
}

// 模块导入即执行（与 db.ts 的 initDb 同一模式），失败只打日志不阻断启动
initContentTables().catch((err: any) => console.error('初始化内容库表失败:', err.message));

// ===== 查询（路由层调用）=====
// 查全部案例，law_refs 从 JSON 字符串解析回数组
export async function listCases(): Promise<LawCase[]> {
  const [rows] = await pool.query<any[]>('SELECT * FROM law_cases ORDER BY id');
  return rows.map((row) => ({
    id: row.id,
    category: row.category,
    title: row.title,
    summary: row.summary ?? '',
    verdict: row.verdict ?? '',
    lawRefs: row.law_refs ? JSON.parse(row.law_refs) : [],
  }));
}

// 查全部法条
export async function listArticles(): Promise<LawArticle[]> {
  const [rows] = await pool.query<any[]>('SELECT * FROM law_articles ORDER BY id');
  return rows.map((row) => ({
    id: row.id,
    category: row.category,
    title: row.title,
    source: row.source ?? '',
    content: row.content ?? '',
  }));
}
