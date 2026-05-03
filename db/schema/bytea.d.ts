import type { customType } from 'drizzle-orm/pg-core';

type ByteaConfig = { data: Buffer; driverData: Buffer };

export declare const bytea: ReturnType<typeof customType<ByteaConfig>>;
