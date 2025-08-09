import { SuiClient, getFullnodeUrl } from '@mysten/sui.js/client';

export const suiClient = new SuiClient({ url: getFullnodeUrl('testnet') });

// Contract constants
export const REGISTRY_ID = '0x8ceec78670c97b8b01a0d50566a85177b8f910527759d93ef50486ef8c10f2e1';
export const PACKAGE_ID = '0x16c8dd907e254555c7a5d592f7b10b6040e19d07be94fc4adc6cdb7138011a55';
export const MODULE = 'dropnew';
export const COIN_TYPE = '0x2::sui::SUI';
export const CLOCK_ID = '0x6';