export interface CJWebhookPayload {
  messageId: string;
  type: 'PRODUCT' | 'VARIANT' | 'STOCK' | 'ORDER' | 'LOGISTIC' | 'SOURCINGCREATE' | 'ORDERSPLIT';
  params: CJProductParams | CJVariantParams | CJStockParams | CJOrderParams | CJOrderSplitParams | CJSourcingCreateParams | any;
}

export interface CJProductParams {
  categoryId: string | null;
  categoryName: string | null;
  pid: string;
  productDescription: string | null;
  productImage: string | null;
  productName: string | null;
  productNameEn: string | null;
  productProperty1: string | null;
  productProperty2: string | null;
  productProperty3: string | null;
  productSellPrice: number | null;
  productSku: string | null;
  productStatus: string | null;
  fields: string[]; // Champs modifiés
}

export interface CJVariantParams {
  vid: string;
  variantName: string | null;
  variantWeight: number | null;
  variantLength: number | null;
  variantWidth: number | null;
  variantHeight: number | null;
  variantImage: string | null;
  variantSku: string | null;
  variantKey: string | null;
  variantSellPrice: number | null;
  variantStatus: string | null;
  variantValue1: string | null;
  variantValue2: string | null;
  variantValue3: string | null;
  fields: string[]; // Champs modifiés
}

export interface CJStockParams {
  [vid: string]: CJStockInfo[];
}

export interface CJStockInfo {
  vid: string;
  areaId: string;
  areaEn: string;
  countryCode: string;
  storageNum: number;
}

export interface CJOrderParams {
  orderNumber: string;
  cjOrderId: number;
  orderStatus: string;
  logisticName: string;
  trackNumber: string | null;
  createDate: string;
  updateDate: string;
  payDate: string | null;
  deliveryDate: string | null;
  completeDate: string | null;
}

export interface CJOrderSplitParams {
  originalOrderId: string;
  splitOrderList: CJSplitOrder[];
  orderSplitTime: string;
}

export interface CJSplitOrder {
  createAt: number;
  orderCode: string;
  orderStatus: number;
  productList: CJSplitOrderProduct[];
}

export interface CJSplitOrderProduct {
  sku: string;
  vid: string;
  quantity: number;
  productCode: string;
}

export interface CJSourcingCreateParams {
  cjProductId: string;
  cjVariantId: string;
  cjVariantSku: string;
  cjSourcingId: string;
  status: string;
  failReason: string;
  createDate: string;
}

export interface WebhookProcessingResult {
  success: boolean;
  messageId: string;
  type: string;
  processedAt: Date;
  changes?: string[];
  error?: string;
}