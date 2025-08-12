import { SuiClient, getFullnodeUrl } from '@mysten/sui.js/client';

export const suiClient = new SuiClient({ url: getFullnodeUrl('testnet') });

// Contract constants
export const REGISTRY_ID = '0x8ceec78670c97b8b01a0d50566a85177b8f910527759d93ef50486ef8c10f2e1';
export const PACKAGE_ID = '0x16c8dd907e254555c7a5d592f7b10b6040e19d07be94fc4adc6cdb7138011a55';
export const MODULE = 'dropnew';
export const COIN_TYPE = '0x2::sui::SUI';
export const CLOCK_ID = '0x6';

// Enhanced error handling for transactions
export const handleTransactionError = (error: any): string => {
  console.error('Transaction error:', error);
  
  if (error?.message) {
    const message = error.message.toLowerCase();
    
    // Map common error codes to user-friendly messages
    if (message.includes('e_already_claimed') || message.includes('5')) {
      return "You have already claimed from this droplet";
    }
    if (message.includes('e_droplet_expired') || message.includes('6')) {
      return "This droplet has expired";
    }
    if (message.includes('e_droplet_closed') || message.includes('7')) {
      return "This droplet has been closed";
    }
    if (message.includes('e_receiver_limit_reached') || message.includes('8')) {
      return "This droplet has reached its receiver limit";
    }
    if (message.includes('e_insufficient_balance') || message.includes('9')) {
      return "Insufficient balance in droplet";
    }
    if (message.includes('e_droplet_not_found') || message.includes('11')) {
      return "Droplet not found";
    }
    if (message.includes('e_claimer_name_required') || message.includes('13')) {
      return "Claimer name is required";
    }
    if (message.includes('e_invalid_droplet_id') || message.includes('14')) {
      return "Invalid droplet ID";
    }
    if (message.includes('insufficient funds') || message.includes('insufficient gas')) {
      return "Insufficient SUI for transaction fees";
    }
    if (message.includes('user rejected')) {
      return "Transaction was cancelled";
    }
  }
  
  return "Transaction failed. Please try again.";
};