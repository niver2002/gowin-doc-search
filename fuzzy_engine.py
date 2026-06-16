"""
模糊搜索引擎
- 部分匹配（子串）
- 词序无关
- 相关度评分（标题精确匹配 > 部分匹配 > 首字母缩写）
- 拼写容错（编辑距离）
- 同义词/缩写展开
"""

import re
from difflib import SequenceMatcher


# 同义词/缩写映射
SYNONYMS = {
    "ddr": ["ddr2", "ddr3", "ddr4", "sdram"],
    "usb": ["usb2.0", "usb3.0", "usb 2.0", "usb 3.0"],
    "pcie": ["pci-e", "pci express", "pciephy"],
    "mipi": ["mipi dsi", "mipi csi", "dphy", "d-phy"],
    "hdmi": ["hdmi tx", "hdmi rx"],
    "spi": ["qspi", "spi flash", "spi nor"],
    "i2c": ["iic", "i2c slave", "i2c master"],
    "uart": ["serial", "rs232"],
    "adc": ["analog to digital"],
    "dac": ["digital to analog"],
    "pll": ["phase locked loop", "rpll", "pll"],
    "lvds": ["lvds tx", "lvds rx"],
    "serdes": ["serializer", "deserializer"],
    "eda": ["gowin eda", "云源软件", "ide"],
    "programmer": ["下载器", "offline programmer"],
    "datasheet": ["data sheet", "ds"],
    "user guide": ["userguide", "ug", "用户指南"],
    "schematic": ["sch", "原理图"],
    "errata": ["勘误"],
    "release note": ["releasenote", "发布说明"],
    "reference design": ["refdesign", "ref design", "参考设计"],
}

# 构建反向映射
SYNONYM_EXPAND = {}
for key, aliases in SYNONYMS.items():
    all_terms = [key] + aliases
    for term in all_terms:
        SYNONYM_EXPAND[term.lower()] = all_terms


def expand_query(keyword):
    """展开关键词的同义词"""
    kw_lower = keyword.lower().strip()
    expanded = {kw_lower}

    # 直接命中同义词表
    if kw_lower in SYNONYM_EXPAND:
        for syn in SYNONYM_EXPAND[kw_lower]:
            expanded.add(syn.lower())

    # 检查是否为多词组合中的一部分
    for key, aliases in SYNONYMS.items():
        all_terms = [key] + aliases
        for term in all_terms:
            if kw_lower in term.lower() or term.lower() in kw_lower:
                expanded.add(term.lower())

    return list(expanded)


def calc_relevance(title, keywords, expanded_sets):
    """计算相关度评分（0-100）"""
    title_lower = title.lower()
    score = 0

    for i, kw in enumerate(keywords):
        kw_lower = kw.lower()
        expanded = expanded_sets[i] if i < len(expanded_sets) else [kw_lower]

        # 精确匹配原始关键词（权重最高）
        if kw_lower in title_lower:
            # 完整词匹配
            if re.search(r'\b' + re.escape(kw_lower) + r'\b', title_lower):
                score += 30
            else:
                score += 20
            # 标题开头加分
            if title_lower.startswith(kw_lower):
                score += 10
        else:
            # 同义词匹配
            syn_matched = False
            for syn in expanded:
                if syn != kw_lower and syn in title_lower:
                    score += 12
                    syn_matched = True
                    break

            if not syn_matched:
                # 编辑距离容错（对长度>=4的词用编辑距离，短词用子串匹配）
                if len(kw_lower) >= 4:
                    words_in_title = re.findall(r'[a-z0-9]+', title_lower)
                    best_ratio = 0
                    for word in words_in_title:
                        if len(word) >= 3:
                            ratio = SequenceMatcher(None, kw_lower, word).ratio()
                            best_ratio = max(best_ratio, ratio)
                    if best_ratio >= 0.75:
                        score += int(best_ratio * 15)
                    else:
                        return 0  # 某个关键词完全不匹配
                else:
                    # 短词：检查子串 + 编辑距离容错
                    words_in_title = re.findall(r'[a-z0-9]+', title_lower)
                    substr_found = any(kw_lower in w for w in words_in_title)
                    if substr_found:
                        score += 8
                    else:
                        # 短词也尝试编辑距离（如 mpi vs mipi）
                        best_ratio = 0
                        for word in words_in_title:
                            if len(word) >= 2:
                                ratio = SequenceMatcher(None, kw_lower, word).ratio()
                                best_ratio = max(best_ratio, ratio)
                        if best_ratio >= 0.7:
                            score += int(best_ratio * 10)
                        else:
                            return 0

    # 长度惩罚（越短的标题越精确）
    if len(title) < 50:
        score += 5
    elif len(title) > 100:
        score -= 2

    return min(score, 100)


def fuzzy_search(docs, keyword, max_results=100):
    """模糊搜索，返回按相关度排序的结果"""
    if not keyword or not keyword.strip():
        return docs[:max_results]

    keyword = keyword.strip()
    keywords = keyword.split()
    expanded_sets = [expand_query(kw) for kw in keywords]

    # 组合词识别：将多个关键词拼接尝试匹配（如 "mpi dsi" -> "mpidsi", 匹配 "mipi dsi"）
    combined_phrase = keyword.lower()
    combined_no_space = "".join(keywords).lower()

    scored_results = []
    for doc in docs:
        title_lower = doc["title"].lower()

        # 先检查原始短语是否存在于标题中
        phrase_score = 0
        if combined_phrase in title_lower:
            phrase_score = 40
        elif combined_no_space in title_lower.replace(" ", "").replace("-", ""):
            phrase_score = 35
        else:
            # 检查拼接后的词是否为标题某个词的子串（如 "mpidsi" 在 "mipidsi" 中）
            title_compact = title_lower.replace(" ", "").replace("-", "").replace("_", "")
            if combined_no_space in title_compact:
                phrase_score = 30

        if phrase_score > 0:
            scored_results.append((phrase_score, doc))
            continue

        # 逐词匹配评分
        score = calc_relevance(doc["title"], keywords, expanded_sets)
        if score > 0:
            scored_results.append((score, doc))

    # 按分数降序
    scored_results.sort(key=lambda x: -x[0])
    return [doc for _, doc in scored_results[:max_results]]


def fuzzy_match_check(title, keywords, expanded_sets):
    """快速检查是否至少部分匹配"""
    title_lower = title.lower()
    for i, kw in enumerate(keywords):
        kw_lower = kw.lower()
        expanded = expanded_sets[i] if i < len(expanded_sets) else [kw_lower]

        found = False
        # 原词
        if kw_lower in title_lower:
            found = True
        else:
            # 同义词
            for syn in expanded:
                if syn in title_lower:
                    found = True
                    break
        if not found:
            # 容错
            if len(kw_lower) >= 4:
                words_in_title = re.findall(r'[a-z0-9]+', title_lower)
                for word in words_in_title:
                    if len(word) >= 3:
                        ratio = SequenceMatcher(None, kw_lower, word).ratio()
                        if ratio >= 0.75:
                            found = True
                            break
            else:
                # 短词子串 + 编辑距离
                words_in_title = re.findall(r'[a-z0-9]+', title_lower)
                if any(kw_lower in w for w in words_in_title):
                    found = True
                else:
                    for word in words_in_title:
                        if len(word) >= 2:
                            ratio = SequenceMatcher(None, kw_lower, word).ratio()
                            if ratio >= 0.7:
                                found = True
                                break
        if not found:
            return False
    return True
