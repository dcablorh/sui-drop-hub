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
    
    // Map contract error constants to user-friendly messages
    if (message.includes('invalid receiver limit') || message.includes('e_invalid_receiver_limit')) {
      return "Invalid receiver limit, must be between 1 and 100,000";
    }
    if (message.includes('insufficient amount') || message.includes('e_insufficient_amount')) {
      return "Insufficient amount provided for droplet";
    }
    if (message.includes('already claimed') || message.includes('e_already_claimed')) {
      return "You have already claimed from this droplet";
    }
    if (message.includes('droplet expired') || message.includes('e_droplet_expired')) {
      return "This droplet has expired";
    }
    if (message.includes('droplet closed') || message.includes('e_droplet_closed')) {
      return "This droplet is closed";
    }
    if (message.includes('receiver limit reached') || message.includes('e_receiver_limit_reached')) {
      return "Receiver limit reached for this droplet";
    }
    if (message.includes('insufficient balance') || message.includes('e_insufficient_balance')) {
      return "Insufficient balance in droplet to claim";
    }
    if (message.includes('droplet not found') || message.includes('e_droplet_not_found')) {
      return "Droplet ID not found";
    }
    if (message.includes('invalid fee percentage') || message.includes('e_invalid_fee_percentage')) {
      return "Invalid fee percentage, must be between 0 and 10%";
    }
    if (message.includes('claimer name required') || message.includes('e_claimer_name_required')) {
      return "Claimer name is required for claiming";
    }
    if (message.includes('invalid droplet id') || message.includes('e_invalid_droplet_id')) {
      return "Invalid droplet ID, must be exactly 6 characters";
    }
    if (message.includes('insufficient funds') || message.includes('insufficient gas')) {
      return "Insufficient SUI for transaction fees";
    }
    if (message.includes('user rejected') || message.includes('user denied')) {
      return "Transaction was cancelled";
    }
  }
  
  return "Transaction failed. Please try again.";
};