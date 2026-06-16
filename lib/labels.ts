export const CAT_LABELS: Record<string, string> = {
  Software: "软件",
  DataSheet: "数据手册",
  UserGuide: "用户指南",
  Reference: "参考资料",
  ReferenceDesign: "参考设计",
  AppNote: "应用笔记",
  ReleaseNote: "发布说明",
  Schematic: "原理图",
  DevBoard: "开发板",
  QuickStart: "快速入门",
  PackagePinout: "封装引脚",
  Errata: "勘误",
  IP: "IP核",
  SDK: "SDK",
  Advisory: "产品公告",
  Firmware: "固件",
  Certificate: "认证证书",
  Introduction: "产品简介",
  Document: "文档",
  Package: "软件包",
  Other: "其他",
}

// Category accent (kept restrained: a single hue family per category badge)
export const CAT_CLASS: Record<string, string> = {
  Software: "bg-blue-50 text-blue-700",
  DataSheet: "bg-red-50 text-red-700",
  UserGuide: "bg-sky-50 text-sky-700",
  Reference: "bg-indigo-50 text-indigo-700",
  ReferenceDesign: "bg-indigo-50 text-indigo-700",
  AppNote: "bg-green-50 text-green-700",
  ReleaseNote: "bg-amber-50 text-amber-700",
  Schematic: "bg-orange-50 text-orange-700",
  DevBoard: "bg-cyan-50 text-cyan-700",
  QuickStart: "bg-emerald-50 text-emerald-700",
  PackagePinout: "bg-teal-50 text-teal-700",
  Errata: "bg-rose-50 text-rose-700",
  SDK: "bg-teal-50 text-teal-700",
  Advisory: "bg-amber-50 text-amber-700",
  Firmware: "bg-rose-50 text-rose-700",
  Certificate: "bg-fuchsia-50 text-fuchsia-700",
  Introduction: "bg-slate-100 text-slate-600",
  Document: "bg-slate-100 text-slate-600",
  Package: "bg-zinc-100 text-zinc-600",
  Other: "bg-slate-100 text-slate-600",
}

export function categoryLabel(key: string): string {
  const [base, sub] = key.split("/")
  const label = CAT_LABELS[base] ?? base
  return sub ? `${label}/${sub}` : label
}

export function categoryClass(category: string): string {
  return CAT_CLASS[category] ?? CAT_CLASS.Other
}
