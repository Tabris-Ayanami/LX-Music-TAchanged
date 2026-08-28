
import requests
import json


headers = {
    "User-Agent": "Dalvik/2.1.0 (Linux; U; Android 16; Pixel 9 Build/BP4A.260205.001)",
    "Connection": "Keep-Alive",
    "Accept-Encoding": "gzip",
    "Content-Type": "application/json",
    "X-Platform": "android",
    "X-Platform-Flavor": "native",
    "X-Platform-Version": "36",
    "X-Platform-Device": "Pixel 9",
    "X-Platform-Brand": "google",
    "X-Version": "9.22.1",
    "X-Preferred-Locales": "zh_CN",
    "X-Client-Locale": "zh-CN",
    "X-Client-Version": "1.2026.062",
    "X-Client-Bundle-ID": "com.openai.chatgpt",
    "X-Observer-Mode-Enabled": "false",


    "X-Custom-Entitlements-Computation": "true",
    "X-Storefront": "US",
    "X-Is-Debug-Build": "false",
    "X-Kotlin-Version": "2.3.10",
    "X-Is-Backgrounded": "false",
    "X-Billing-Client-Sdk-Version": "8.0.0",
    "Authorization": "Bearer goog_DPguJtknNxbQBStStwhWGRsghUw",
    "X-RevenueCat-ETag": ""
}
url = "https://api.revenuecat.com/v1/receipts"
data = {
    "fetch_token": "ellknbgkcgpphbcjopnjmgna.AO-J1OyKxkSgWiaPIhP7ARyffktU8z5uUwtzGIBOCJ5vQvJCde2ZmknV-yJTLIcrjte5XKDSS6kxwz8QOOgEFFTWNvjLnr3StQ",
    "product_ids": [
        "oai.chatgpt.plus"
    ],
    "platform_product_ids": [
        {
            "product_id": "oai.chatgpt.plus"
        }
    ],
    "app_user_id": "46ee5a3b-97d3-4da0-baa8-061ecf9f1b25",
    "is_restore": True,
    "observer_mode": False,
    "purchase_completed_by": "revenuecat",
    "initiation_source": "unsynced_active_purchases",
    "sdk_originated": False,
    "payload_version": 1
}
data = json.dumps(data, separators=(',', ':'))
response = requests.post(url, headers=headers, data=data)

if response.status_code == 200:
    result = response.json()
    subscriber = result.get("subscriber", {})
    app_user_id = subscriber.get("original_app_user_id", "未知")
    first_seen = subscriber.get("first_seen", "未知")
    last_seen = subscriber.get("last_seen", "未知")

    print("=" * 50)
    print("✅ 充值成功！")
    print("=" * 50)
    print(f"  账号 ID       : {app_user_id}")
    print(f"  首次使用时间  : {first_seen}")
    print(f"  最后活跃时间  : {last_seen}")

    # 解析订阅信息
    subscriptions = subscriber.get("subscriptions", {})
    entitlements = subscriber.get("entitlements", {})

    if subscriptions:
        print("-" * 50)
        print("📦 订阅详情：")
        for product_id, sub_info in subscriptions.items():
            print(f"  产品 ID       : {product_id}")
            print(f"  套餐标识      : {sub_info.get('product_plan_identifier', '未知')}")
            print(f"  购买日期      : {sub_info.get('purchase_date', '未知')}")
            print(f"  到期时间      : {sub_info.get('expires_date', '未知')}")
            print(f"  订阅类型      : {sub_info.get('period_type', '未知')}")
            price = sub_info.get("price", {})
            print(f"  价格          : {price.get('amount', '?')} {price.get('currency', '')}")
            print(f"  商店          : {sub_info.get('store', '未知')}")
            print(f"  交易 ID       : {sub_info.get('store_transaction_id', '未知')}")
            print(f"  是否沙盒      : {'是' if sub_info.get('is_sandbox') else '否'}")
            print(f"  是否已退款    : {'是 (' + sub_info['refunded_at'] + ')' if sub_info.get('refunded_at') else '否'}")
            print()

    if entitlements:
        print("-" * 50)
        print("🔑 权益信息：")
        for ent_name, ent_info in entitlements.items():
            print(f"  权益名称      : {ent_name}")
            print(f"  产品标识      : {ent_info.get('product_identifier', '未知')}")
            print(f"  套餐标识      : {ent_info.get('product_plan_identifier', '未知')}")
            print(f"  购买日期      : {ent_info.get('purchase_date', '未知')}")
            print(f"  到期时间      : {ent_info.get('expires_date', '未知')}")
            print()

    # 管理链接
    mgmt_url = subscriber.get("management_url")
    if mgmt_url:
        print("-" * 50)
        print(f"🔗 管理链接    : {mgmt_url}")

    print("=" * 50)
else:
    print(f"❌ 请求失败！状态码: {response.status_code}")
    try:
        err = response.json()
        print(f"  错误信息: {json.dumps(err, ensure_ascii=False, indent=2)}")
    except Exception:
        print(f"  响应内容: {response.text}")