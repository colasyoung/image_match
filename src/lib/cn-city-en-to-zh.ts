import {
  cnEnProvinceLabelToZh,
  cnIso31662CodeToZh,
  matchTaiwanIocSegment,
  normalizeChinaRegionCode,
} from "@/lib/cn-region-iso";

/**
 * GeoIP / 浏览器常见英文城市名 → 中文（用于「中国｜广东省｜Shenzhen」等混合路径的中文展示）。
 * 未收录的名称原样返回，由上游逐步补全。
 */
const EN_CITY_TO_ZH: Record<string, string> = {
  shenzhen: "深圳",
  guangzhou: "广州",
  dongguan: "东莞",
  foshan: "佛山",
  zhuhai: "珠海",
  zhongshan: "中山",
  huizhou: "惠州",
  jiangmen: "江门",
  zhaoqing: "肇庆",
  shantou: "汕头",
  shaoguan: "韶关",
  heyuan: "河源",
  meizhou: "梅州",
  shanwei: "汕尾",
  yangjiang: "阳江",
  qingyuan: "清远",
  chaozhou: "潮州",
  jieyang: "揭阳",
  yunfu: "云浮",
  beijing: "北京",
  shanghai: "上海",
  tianjin: "天津",
  chongqing: "重庆",
  hangzhou: "杭州",
  ningbo: "宁波",
  wenzhou: "温州",
  jiaxing: "嘉兴",
  huzhou: "湖州",
  shaoxing: "绍兴",
  jinhua: "金华",
  quzhou: "衢州",
  zhoushan: "舟山",
  taizhou: "台州",
  lishui: "丽水",
  nanjing: "南京",
  suzhou: "苏州",
  wuxi: "无锡",
  xuzhou: "徐州",
  changzhou: "常州",
  nantong: "南通",
  lianyungang: "连云港",
  huaian: "淮安",
  yancheng: "盐城",
  yangzhou: "扬州",
  zhenjiang: "镇江",
  suqian: "宿迁",
  chengdu: "成都",
  mianyang: "绵阳",
  deyang: "德阳",
  leshan: "乐山",
  wuhan: "武汉",
  yichang: "宜昌",
  xiangyang: "襄阳",
  jingzhou: "荆州",
  huangshi: "黄石",
  shiyan: "十堰",
  xian: "西安",
  "xi'an": "西安",
  xianyang: "咸阳",
  baoji: "宝鸡",
  weinan: "渭南",
  zhengzhou: "郑州",
  luoyang: "洛阳",
  kaifeng: "开封",
  changsha: "长沙",
  zhuzhou: "株洲",
  xiangtan: "湘潭",
  hefei: "合肥",
  wuhu: "芜湖",
  bengbu: "蚌埠",
  nanchang: "南昌",
  ganzhou: "赣州",
  jiujiang: "九江",
  fuzhou: "福州",
  xiamen: "厦门",
  quanzhou: "泉州",
  nanning: "南宁",
  liuzhou: "柳州",
  kunming: "昆明",
  dali: "大理",
  guiyang: "贵阳",
  haikou: "海口",
  sanya: "三亚",
  urumqi: "乌鲁木齐",
  lhasa: "拉萨",
  harbin: "哈尔滨",
  changchun: "长春",
  shenyang: "沈阳",
  dalian: "大连",
  qingdao: "青岛",
  jinan: "济南",
  yantai: "烟台",
  weifang: "潍坊",
  jining: "济宁",
  taiyuan: "太原",
  shijiazhuang: "石家庄",
  tangshan: "唐山",
  baoding: "保定",
  handan: "邯郸",
  hohhot: "呼和浩特",
  baotou: "包头",
  "hong kong": "香港",
  hongkong: "香港",
  macau: "澳门",
  macao: "澳门",
};

function normalizeCityKey(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/\s+city$/i, "")
    .trim();
}

/** 将「中国」路径下仍为纯拉丁字母的片段尽量换成中文（省或市）。 */
export function cnChinaPathLatinSegmentToZh(segment: string): string {
  const raw = segment.trim();
  if (!raw) return segment;
  if (matchTaiwanIocSegment(raw)) return "中华台北";
  if (/[\u4e00-\u9fff]/.test(raw)) return segment;

  const cnSub = normalizeChinaRegionCode(raw);
  if (cnSub) {
    const fromCode = cnIso31662CodeToZh(cnSub);
    if (fromCode) return fromCode;
  }

  const prov = cnEnProvinceLabelToZh(raw);
  if (prov) return prov;

  const k = normalizeCityKey(raw);
  return EN_CITY_TO_ZH[k] ?? EN_CITY_TO_ZH[k.replace(/['’]/g, "")] ?? segment;
}
