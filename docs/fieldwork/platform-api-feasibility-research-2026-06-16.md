# 平台 API 可行性与费用调研

日期：2026-06-16

## 调研结论

API 方案可以减少或避免多设备登录态互踢，但不能只确认“有 API”。必须逐字段验证 API、报表导出和页面采集三种来源的覆盖度。

初步判断：

- 订单、商品、库存、履约等标准经营数据，API 覆盖概率较高。
- 结算、广告费、利润、成本价、罚款、活动价、特殊经营分析指标，必须逐项验证。
- 多数平台未在公开官方文档中给出明确 API 调用收费表，需要通过平台开发者后台、商务、客户经理或服务商渠道确认。
- API 接入通常需要卖家主账号授权、开发者应用审核、接口权限申请和限流评估。

## 平台初判

| 平台 | API 覆盖度初判 | 费用初判 | 关键风险 |
|---|---|---|---|
| Temu | 中到高 | 未找到公开官方收费表 | 价格、结算、合同价、利润类字段需重点验证 |
| SHEIN | 中到高 | 未找到公开官方收费表 | 应用授权由主账号完成，子账号不能授权应用 |
| TikTok Shop | 高 | 未找到公开官方收费表 | 受授权范围、地区、限流、财务接口权限影响 |
| 聚水潭 | 高 | 未找到公开官方收费表 | 需要客户开放平台账号、应用、授权和接口权限 |
| 京东 | 高 | 未找到公开官方收费表 | 京东宙斯接口多，需按店铺类型和业务域确认权限 |
| Amazon | 高 | SP-API usage/annual fees 已取消；卖家账户费用另算 | 权限审核严格，敏感数据需审批 |
| Walmart | 高 | 未找到公开官方收费表 | 面向卖家和 approved solution providers |
| Shopee | 高 | 未找到公开官方收费表 | 区域差异、店铺授权和应用类型影响权限 |
| Lazada | 高 | 条款保留收费权利 | 高级权限、额度或工具可能后续收费 |
| eBay | 高 | 开发者计划可免费加入，免费层级存在 | 销售、刊登和高级支持费用另算 |
| Shopify | 高 | API 本身未见单独公开调用费；店铺套餐另算 | 取决于店铺套餐、应用类型和 API scopes |

## Temu

### 能力判断

Temu Open Platform 提供基于 HTTPS 的 API 访问。官方文档说明，开发者或 ISV 加入开放平台后可以按要求调用 API；非公开 API 需要卖家在 Seller Center 中授权应用。公开资料显示 Temu API 资源包含 Order Management、Pricing、Order Fulfillment、Webhook、Comment 等；Product API 面向大规模商品管理。

### 覆盖风险

Temu 的订单、履约、商品和部分价格相关能力值得优先验证。但如果目标字段涉及合同价、成本价、结算价、利润核算、广告或经营分析指标，需要逐项确认。第三方集成文档中提到部分价格或合同价可能仍需要后台导出补充，因此不能假设 API 一定覆盖全部财务口径。

### 费用判断

未找到 Temu 官方公开 API 调用收费表。需要通过 Temu Partner/Open Platform 后台、客户经理或服务商申请流程确认。

### 来源

- [Temu API Request Endpoints](https://partner.temu.com/documentation?menu_code=38e79b35d2cb463d85619c1c786dd303&sub_menu_code=8311de2b2d434e4d805e88413ab815d8)
- [Temu Seller Authorization Guide](https://partner.temu.com/documentation?menu_code=38e79b35d2cb463d85619c1c786dd303)
- [Temu Product Basic Introduction](https://partner-eu.temu.com/documentation?menu_code=85762c6ccc5a4dbc8c023ea5e10c6dc0&sub_menu_code=894d49588571477da64a04a5d81b53a7)
- [Temu Open Platform Postman Workspace](https://www.postman.com/temu-open/temu-open-platform/overview)
- [Goflow Temu integration note](https://goflow.com/docs/store/temu)

## SHEIN

### 能力判断

SHEIN Developer Platform 公开展示 Product Management、SHEIN Fulfill Order Management、Seller Fulfill Order Management、Stock Preparation Order Fulfill Management、Webhook、OpenAPI 等业务方案。开发者文档中包含商品、订单、退货、采购等 API 分类，并存在订单详情接口。

### 覆盖风险

订单、商品、履约和退货类数据优先验证 API。广告、结算、罚款、利润和特殊运营分析字段需要按字段核对。

### 授权限制

SHEIN 官方 FAQ 明确说明：子账号不能授权应用，只有商家主账号可以完成应用授权。这意味着 API 初次授权需要客户主账号参与，但授权后理论上不需要每日浏览器登录。

### 费用判断

未找到 SHEIN 官方公开 API 调用收费表。SHEIN Seller Marketplace 页面提到 zero monthly fees 属于卖家平台信息，不能直接等同 API 费用。API 准入和接口权限仍需通过 Open Platform 申请、应用审核和授权流程确认。

### 来源

- [SHEIN Developer Platform](https://open.sheincorp.com/en)
- [SHEIN Developer Documentation](https://open.sheincorp.com/documents/system/dad0d1c7-be76-4b03-a735-4e23f012bdd9)
- [SHEIN API categories](https://open.sheincorp.com/documents/apidoc/1000001)
- [SHEIN order detail API](https://open.sheincorp.com/documents/apidoc/detail/3001563)
- [SHEIN authorization FAQ](https://open.sheincorp.com/documents/faq-detail/119)
- [SHEIN Seller Marketplace](https://seller-us.shein.com/)

## TikTok Shop

### 能力判断

TikTok Shop Partner Center 提供 TTS API。官方概览说明 API 可访问用户授权数据，包括 catalogs、orders 等。公开文档包含 Seller API、Products API、Finance API、Authorization、Access Scope 和 Rate Limits 等内容。

### 覆盖风险

TikTok Shop 的商品、订单、店铺、财务交易和付款明细应优先走 API。结算报表也可通过 Seller Center 导出流程补充。需要按地区和店铺站点确认 Finance API、广告数据、联盟/达人费用等字段是否可用。

### 费用判断

未找到 TikTok Shop 官方公开 API 调用收费表。需要重点确认应用类型、Partner Center 准入、接口权限、调用限流和是否需要 TSP/服务商身份。

### 来源

- [TikTok Shop API concepts overview](https://partner.tiktokshop.com/docv2/page/tts-api-concepts-overview)
- [TikTok Shop Seller API](https://partner.tiktokshop.com/docv2/page/seller-api-overview)
- [TikTok Shop Products API](https://partner.tiktokshop.com/docv2/page/products-api-overview)
- [TikTok Shop Finance API](https://partner.tiktokshop.com/docv2/page/finance-api-overview)
- [TikTok Shop Authorization Overview](https://partner.tiktokshop.com/docv2/page/authorization-overview-202407)
- [TikTok Shop Access Scope](https://partner.tiktokshop.com/docv2/page/access-scope)
- [TikTok Shop Rate Limits](https://partner.tiktokshop.com/docv2/page/rate-limits)
- [TikTok Shop Seller Center TSP authorization note](https://seller-us.tiktok.com/university/essay?knowledge_id=6121689348146987&lang=en)

## 聚水潭

### 能力判断

聚水潭开放平台公开说明需要注册开放平台账号、开发测试、入驻开放平台成为开发者并进行商家账号授权、申请接口调用权限。公开 API 文档覆盖基础 API、商品 API、库存 API、订单 API、物流 API、采购 API、入库 API、财务 API、WMS API 等。

### 覆盖风险

聚水潭本身可能已经沉淀了跨平台订单、库存、采购、物流和财务数据。如果客户正在使用聚水潭，应优先评估从聚水潭取数，而不是逐个平台登录后台采集。

### 费用判断

未找到聚水潭官方公开 API 调用收费表。需要客户提供开放平台账号或由商务确认接口权限、应用类型、调用额度和费用。

### 来源

- [聚水潭开放平台](https://open.jushuitan.com/)
- [聚水潭开放平台 API 文档入口](https://openweb.jushuitan.com/dev-doc)
- [聚水潭 API 说明](https://openweb.jushuitan.com/dev-doc?docId=22&docType=4)

## 京东

### 能力判断

京东开放平台/宙斯开发者中心通过开放 API 形式对外提供商品、交易、仓储、物流、售后等能力。对于京东商家数据，应优先通过宙斯 API 列表按业务域验证接口。

### 覆盖风险

京东接口数量多、业务域复杂，不同店铺类型、POP/自营/云交易、京东物流和售后场景可能对应不同接口包。需要按客户实际后台和字段清单逐项验证。

### 费用判断

未找到京东开放平台公开统一 API 收费表。需要在京东开放平台后台确认应用接入、接口权限、调用额度和商务要求。

### 来源

- [京东开放平台 宙斯开发者中心](https://jos.jd.com/)
- [京东开放平台 API 列表](https://jos.jd.com/apilist)
- [京东物流开放平台](https://open.jdl.com/)

## 其他平台补充来源

- [Amazon SP-API Documentation](https://developer-docs.amazon.com/sp-api/docs/welcome)
- [Amazon SP-API fees cancellation](https://developer.amazonservices.com/cancellation-of-sp-api-fees)
- [Walmart Marketplace APIs](https://developer.walmart.com/us-marketplace/docs/introduction-to-marketplace-apis)
- [Shopee Open Platform](https://open.shopee.com/)
- [Shopee Developer Guide](https://open.shopee.com/developer-guide/4)
- [Lazada Open Platform](https://open.lazada.com/)
- [Lazada Seller Authorization](https://open.lazada.com/apps/doc/doc?docId=108260&nodeId=10777)
- [Lazada Developer Agreement fee clause](https://open.alitrip.com/docs/doc.htm?articleId=120731&docType=1&treeId=499)
- [eBay Developers Program](https://developer.ebay.com/)
- [eBay Get Started with APIs](https://developer.ebay.com/develop/guides-v2/get-started-with-ebay-apis)
- [Shopify Admin API authentication](https://shopify.dev/docs/api/usage/authentication)
- [Shopify custom app access tokens](https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens/generate-app-access-tokens-admin)

## 下一步字段验证方法

每个平台必须建立字段覆盖矩阵，至少包含：

- 当前人工采集字段；
- 当前来源页面或报表；
- API 是否可取；
- 报表是否可取；
- 是否必须浏览器页面采集；
- 权限、费用、限流和授权条件；
- 官方来源链接；
- 已验证样例和负责人确认。

只有字段矩阵验证通过后，才能决定该平台进入 API 开发、报表解析、分布式采集或浏览器兜底路径。
