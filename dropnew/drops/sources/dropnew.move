#[allow(duplicate_alias, unused_variable, unused_type_parameter, lint(self_transfer))]

module dropnew::dropnew ;
    use sui::coin::{Self, Coin};
    use sui::clock::{Self, Clock};
    use sui::tx_context::TxContext;
    use sui::object::{Self, UID};
    use sui::table::{Self, Table};
    use sui::hash;
    use sui::address;
    use sui::bcs;
    use sui::event;
    use std::option::{Self, Option};
    use std::string::{Self, String};
    use std::vector;

    // ===== Constants =====
    const CONTRACT_OWNER: address = @owner;
    const DEFAULT_EXPIRY_HOURS: u64 = 48; // 48 hours default
    const MILLISECONDS_PER_HOUR: u64 = 3600000;
    
    // Error codes
    #[error]
    const E_INVALID_RECEIVER_LIMIT: vector<u8> = b"Invalid receiver limit, must be between 1 and 100000";
     #[error]
    const E_INSUFFICIENT_AMOUNT: vector<u8> = b"Insufficient amount provided for droplet";
     #[error]
    const E_ALREADY_CLAIMED: vector<u8> = b"You have already claimed from this droplet";
     #[error]
    const E_DROPLET_EXPIRED: vector<u8> = b"This droplet has expired";
     #[error]
    const E_DROPLET_CLOSED: vector<u8> = b"This droplet is  closed";
     #[error]
    const E_RECEIVER_LIMIT_REACHED: vector<u8> = b"Receiver limit reached for this droplet";
     #[error]
    const E_INSUFFICIENT_BALANCE: vector<u8> = b"Insufficient balance in droplet to claim";
     #[error]
    const E_DROPLET_NOT_FOUND: vector<u8> = b" Droplet ID not found";
     #[error]
    const E_INVALID_FEE_PERCENTAGE: vector<u8> =b"Invalid fee percentage, must be between 0 and 1000 (10%)";
     #[error]
    const E_CLAIMER_NAME_REQUIRED: vector<u8> = b"Claimer name is required for claiming";
     #[error]
    const E_INVALID_DROPLET_ID: vector<u8> = b"Invalid droplet ID, must be exactly 6 characters";

    // ===== Structs =====
    
    // Global registry to store all droplets and platform data
    public struct DropletRegistry has key {
        id: UID,
        droplets: Table<String, address>, // droplet_id -> droplet_address
        fee_percentage: u64, // Fee in basis points (130 = 1.3%)
        total_droplets_created: u64,
        total_fees_collected: Table<String, u64>, // token_type -> total_fees
        user_created_droplets: Table<address, vector<String>>, // user -> droplet_ids
        user_claimed_droplets: Table<address, vector<String>>, // user -> droplet_ids
    }

    // Individual droplet object
    #[allow(lint(coin_field))]
    public struct Droplet<phantom CoinType> has key, store {
        id: UID,
        droplet_id: String, // 6-character code
        sender: address,
        total_amount: u64,
        claimed_amount: u64,
        receiver_limit: u64,
        num_claimed: u64,
        created_at: u64,
        expiry_time: u64, // Absolute timestamp when droplet expires
        claimed: Table<address, String>, // address -> claimer_name
        claimers_list: vector<address>, // Ordered list of claimers
        claimer_names: vector<String>, // Corresponding names
        coin: Coin<CoinType>,
        is_closed: bool,
        message: String,
    }

    // One-time initialization capability
    public struct AdminCap has key {
        id: UID,
    }

    // Droplet info struct for queries
    public struct DropletInfo has copy, drop {
        droplet_id: String,
        sender: address,
        total_amount: u64,
        claimed_amount: u64,
        remaining_amount: u64,
        receiver_limit: u64,
        num_claimed: u64,
        created_at: u64,
        expiry_time: u64,
        is_expired: bool,
        is_closed: bool,
        message: String,
        claimers: vector<address>,
        claimer_names: vector<String>,
    }

    // ===== Events =====

    // Emitted when a new droplet is created
    public struct DropletCreated has copy, drop {
        droplet_id: String,
        sender: address,
        total_amount: u64,
        fee_amount: u64,
        net_amount: u64,
        receiver_limit: u64,
        expiry_hours: u64,
        message: String,
        amount_per_receiver: u64,
        created_at: u64,
        expiry_time: u64,
    }

    // Emitted when someone claims from a droplet
    public struct DropletClaimed has copy, drop {
        droplet_id: String,
        claimer: address,
        claimer_name: String,
        claim_amount: u64,
        message: String,
        claimed_at: u64,
        
        
    }

    // Emitted when a droplet is closed or cleaned up
    public struct DropletClosed has copy, drop {
        droplet_id: String,
        sender: address,
        refund_amount: u64,
        total_claimed: u64,
        num_claimers: u64,
        reason: String,
        closed_at: u64,
        remaining_amount: u64,
    }

    // Emitted when fee percentage is updated
    public struct FeePercentageUpdated has copy, drop {
        old_fee: u64,
        new_fee: u64,
        updated_by: address,
        timestamp: u64,
    }

    // Emitted when fees are collected
    public struct FeeCollected has copy, drop {
        droplet_id: String,
        token_type: String,
        fee_amount: u64,
        recipient: address,
        timestamp: u64,
    }

    // ===== Init Function =====
    
    fun init(ctx: &mut TxContext) {
        // Create admin capability
        let admin_cap = AdminCap {
            id: object::new(ctx),
        };
        sui::transfer::transfer(admin_cap, tx_context::sender(ctx));

        // Create global droplet registry with initial settings
        let registry = DropletRegistry {
            id: object::new(ctx),
            droplets: table::new(ctx),
            fee_percentage: 130, // 1.3% in basis points
            total_droplets_created: 0,
            total_fees_collected: table::new(ctx),
            user_created_droplets: table::new(ctx),
            user_claimed_droplets: table::new(ctx),
        };
        sui::transfer::share_object(registry);
    }

    // ===== Helper Functions =====

    // Generate a 6-character droplet ID using hash
    fun generate_droplet_id(sender: address, timestamp: u64, ctx: &mut TxContext): String {
        let mut data = vector::empty<u8>();
        vector::append(&mut data, address::to_bytes(sender));
        vector::append(&mut data, bcs::to_bytes(&timestamp));
        vector::append(&mut data, bcs::to_bytes(&tx_context::fresh_object_address(ctx)));
        
        let hash_bytes = hash::keccak256(&data);
        let mut id_chars = vector::empty<u8>();
        
        // Convert first 6 bytes to alphanumeric characters
        let charset = b"0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        let mut i = 0;
        while (i < 6 && i < vector::length(&hash_bytes)) {
            let byte_val = *vector::borrow(&hash_bytes, i);
            let char_index = (byte_val as u64) % 36;
            vector::push_back(&mut id_chars, *vector::borrow(&charset, char_index));
            i = i + 1;
        };
        
        string::utf8(id_chars)
    }

    // Get token type as string for tracking
    #[allow(unused_type_parameter)]
    fun get_token_type<CoinType>(): String {
        
        string::utf8(b"COIN_TYPE")
    }

    // Calculate claim amount (equal distribution)
    fun calculate_claim_amount(remaining_amount: u64, remaining_receivers: u64): u64 {
        if (remaining_receivers == 0) {
            0
        } else {
            remaining_amount / remaining_receivers
        }
    }

    // Update user history in registry
    fun update_user_history(
        registry: &mut DropletRegistry,
        user: address,
        droplet_id: String,
        is_created: bool,
        _ctx: &TxContext 
    ) {
        if (is_created) {
            if (!table::contains(&registry.user_created_droplets, user)) {
                table::add(&mut registry.user_created_droplets, user, vector::empty<String>());
            };
            let user_droplets = table::borrow_mut(&mut registry.user_created_droplets, user);
            vector::push_back(user_droplets, droplet_id);
        } else {
            if (!table::contains(&registry.user_claimed_droplets, user)) {
                table::add(&mut registry.user_claimed_droplets, user, vector::empty<String>());
            };
            let user_droplets = table::borrow_mut(&mut registry.user_claimed_droplets, user);
            vector::push_back(user_droplets, droplet_id);
        };
    }



    // Create a new droplet with optional expiry duration
    public entry fun create_droplet<CoinType>(
        registry: &mut DropletRegistry,
        total_amount: u64,
        receiver_limit: u64,
        expiry_hours: Option<u64>, // If None, uses default 48 hours
        message: String,
        mut coin: Coin<CoinType>,
        clock: &Clock,
        ctx: &mut TxContext 
    ) {
        // Validations
        assert!(receiver_limit > 0 && receiver_limit <= 100000, E_INVALID_RECEIVER_LIMIT);
        assert!(total_amount > 0, E_INSUFFICIENT_AMOUNT);
        assert!(coin::value(&coin) == total_amount, E_INSUFFICIENT_AMOUNT);

        let sender = tx_context::sender(ctx);
        let current_time = clock::timestamp_ms(clock);
        
        // Calculate expiry time
        let hours = if (option::is_some(&expiry_hours)) {
            *option::borrow(&expiry_hours)
        } else {
            DEFAULT_EXPIRY_HOURS
        };
        let expiry_time = current_time + (hours * MILLISECONDS_PER_HOUR);

        // Calculate fee
        let fee_amount = total_amount * registry.fee_percentage / 10000;

        // Split coin for fee and send to contract owner
        if (fee_amount > 0) {
            let fee_coin = coin::split(&mut coin, fee_amount, ctx);
            sui::transfer::public_transfer(fee_coin, CONTRACT_OWNER);
        };

        // Generate unique droplet ID
        let droplet_id = generate_droplet_id(sender, current_time, ctx);
        
        // Update fee tracking
        let token_type = get_token_type<CoinType>();
        if (!table::contains(&registry.total_fees_collected, token_type)) {
            table::add(&mut registry.total_fees_collected, token_type, 0);
        };
        let current_fees = table::borrow_mut(&mut registry.total_fees_collected, token_type);
        *current_fees = *current_fees + fee_amount;

        // Create droplet object
        let droplet_uid = object::new(ctx);
        let net_amount = coin::value(&coin);
        let droplet = Droplet<CoinType> {
            id: droplet_uid,
            droplet_id,
            sender,
            total_amount: net_amount,
            claimed_amount: 0,
            receiver_limit,
            num_claimed: 0,
            created_at: current_time,
            expiry_time,
            claimed: table::new(ctx),
            claimers_list: vector::empty<address>(),
            claimer_names: vector::empty<String>(),
            coin,
            is_closed: false,
            message,
        };

        // Get droplet address and register
        let droplet_addr = object::id_address(&droplet);
        table::add(&mut registry.droplets, droplet_id, droplet_addr);
        
        // Update registry stats
        registry.total_droplets_created = registry.total_droplets_created + 1;
        
        // Update user history
        update_user_history(registry, sender, droplet_id, true, ctx);

        // Emit events
        event::emit(FeeCollected {
            droplet_id,
            token_type,
            fee_amount,
            recipient: CONTRACT_OWNER,
            timestamp: current_time,
        });

        event::emit(DropletCreated {
            droplet_id,
            sender,
            total_amount,
            net_amount,
            fee_amount,
            receiver_limit,
            expiry_hours: hours,
            message,
            amount_per_receiver: calculate_claim_amount(net_amount, receiver_limit),
            created_at: current_time,
            expiry_time,
        });

        // Share the droplet object
        sui::transfer::share_object(droplet);
    }

    // Claim function with droplet_id lookup - requires frontend to resolve droplet object
    public entry fun claim<CoinType>(
        registry: &mut DropletRegistry,
        droplet_id: String,
        claimer_name: String,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        // Input validations
        assert!(string::length(&droplet_id) == 6, E_INVALID_DROPLET_ID);
        assert!(string::length(&claimer_name) > 0, E_CLAIMER_NAME_REQUIRED);

        // Find droplet address by ID
        assert!(table::contains(&registry.droplets, droplet_id), E_DROPLET_NOT_FOUND);
        
        
        
        abort E_DROPLET_NOT_FOUND // Placeholder - actual implementation needs droplet object
    }

    // Internal claim function that does the actual work - called with droplet object
    public entry fun claim_internal<CoinType>(
        registry: &mut DropletRegistry,
        droplet: &mut Droplet<CoinType>,
        droplet_id: String,
        claimer_name: String,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let claimer = tx_context::sender(ctx);
        let current_time = clock::timestamp_ms(clock);

        // Input validations
        assert!(string::length(&droplet_id) == 6, E_INVALID_DROPLET_ID);
        assert!(string::length(&claimer_name) > 0, E_CLAIMER_NAME_REQUIRED);
        
        // Verify droplet ID matches the droplet object
        assert!(droplet.droplet_id == droplet_id, E_INVALID_DROPLET_ID);

        
        assert!(!droplet.is_closed, E_DROPLET_CLOSED);
        assert!(!table::contains(&droplet.claimed, claimer), E_ALREADY_CLAIMED);
        assert!(droplet.num_claimed < droplet.receiver_limit, E_RECEIVER_LIMIT_REACHED);

        
        if (current_time >= droplet.expiry_time) {
            cleanup_expired_droplet(droplet, clock, ctx);
            abort E_DROPLET_EXPIRED
        };

        // Balance validations
        let remaining_balance = coin::value(&droplet.coin);
        assert!(remaining_balance > 0, E_INSUFFICIENT_BALANCE);

        // Calculate claim amount
        let remaining_receivers = droplet.receiver_limit - droplet.num_claimed;
        let claim_amount = calculate_claim_amount(remaining_balance, remaining_receivers);

        // Ensure we don't exceed available balance
        let final_claim_amount = if (claim_amount > remaining_balance) {
            remaining_balance
        } else {
            claim_amount
        };

        // Transfer tokens to claimer
        let claim_coin = coin::split(&mut droplet.coin, final_claim_amount, ctx);
        sui::transfer::public_transfer(claim_coin, claimer);

        // Update droplet state
        table::add(&mut droplet.claimed, claimer, claimer_name);
        vector::push_back(&mut droplet.claimers_list, claimer);
        vector::push_back(&mut droplet.claimer_names, claimer_name);
        droplet.num_claimed = droplet.num_claimed + 1;
        droplet.claimed_amount = droplet.claimed_amount + final_claim_amount;

        // Update user history in registry
        update_user_history(registry, claimer, droplet.droplet_id, false, ctx);

        let remaining_after_claim = coin::value(&droplet.coin);

        // Emit claim event
        event::emit(DropletClaimed {
            droplet_id: droplet.droplet_id,
            claimer,
            claimer_name,
            claim_amount: final_claim_amount,
            message: droplet.message,
            claimed_at: current_time,
        });

        // Close droplet if conditions met
        if (droplet.num_claimed >= droplet.receiver_limit || remaining_after_claim == 0) {
            close_droplet(droplet, string::utf8(b"completed"), current_time, ctx);
        };
    }

    // Cleanup expired droplet (public function)
    public entry fun cleanup_droplet<CoinType>(
        droplet: &mut Droplet<CoinType>,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let current_time = clock::timestamp_ms(clock);
        assert!(current_time >= droplet.expiry_time, E_DROPLET_EXPIRED);
        assert!(!droplet.is_closed, E_DROPLET_CLOSED);
        
        cleanup_expired_droplet(droplet, clock, ctx);
    }

    // Internal function to handle expired droplet cleanup
    fun cleanup_expired_droplet<CoinType>(
        droplet: &mut Droplet<CoinType>,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let current_time = clock::timestamp_ms(clock);
        close_droplet(droplet, string::utf8(b"expired"), current_time, ctx);
    }

    // Internal function to close droplet and refund
    fun close_droplet<CoinType>(
        droplet: &mut Droplet<CoinType>,
        reason: String,
        current_time: u64,
        ctx: &mut TxContext
    ) {
        let remaining_balance = coin::value(&droplet.coin);
        
        // Refund remaining balance to sender
        if (remaining_balance > 0) {
            let refund_coin = coin::split(&mut droplet.coin, remaining_balance, ctx);
            sui::transfer::public_transfer(refund_coin, droplet.sender);
        };
        
        // Mark as closed
        droplet.is_closed = true;
        
        // Emit close event
        event::emit(DropletClosed {
            droplet_id: droplet.droplet_id,
            sender: droplet.sender,
            refund_amount: remaining_balance,
            total_claimed: droplet.claimed_amount,
            num_claimers: droplet.num_claimed,
            remaining_amount: remaining_balance,
            reason,
            closed_at: current_time,
        });
    }

    // ===== Admin Functions =====

    // Update platform fee percentage (admin only)
    public entry fun set_fee_percentage(
        _: &AdminCap,
        registry: &mut DropletRegistry,
        new_fee_percentage: u64,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        assert!(new_fee_percentage <= 1000, E_INVALID_FEE_PERCENTAGE); // Max 10%
        
        let old_fee = registry.fee_percentage;
        registry.fee_percentage = new_fee_percentage;
        
        event::emit(FeePercentageUpdated {
            old_fee,
            new_fee: new_fee_percentage,
            updated_by: tx_context::sender(ctx),
            timestamp: clock::timestamp_ms(clock),
        });
    }

    // ===== View Functions =====

    // Get complete droplet information
    public fun get_droplet_info<CoinType>(
        droplet: &Droplet<CoinType>,
        clock: &Clock
    ): DropletInfo {
        let current_time = clock::timestamp_ms(clock);
        let remaining_amount = coin::value(&droplet.coin);
        let is_expired = current_time >= droplet.expiry_time;
        
        DropletInfo {
            droplet_id: droplet.droplet_id,
            sender: droplet.sender,
            total_amount: droplet.total_amount,
            claimed_amount: droplet.claimed_amount,
            remaining_amount,
            receiver_limit: droplet.receiver_limit,
            num_claimed: droplet.num_claimed,
            created_at: droplet.created_at,
            expiry_time: droplet.expiry_time,
            is_expired,
            is_closed: droplet.is_closed,
            message: droplet.message,
            claimers: droplet.claimers_list,
            claimer_names: droplet.claimer_names,
        }
    }

    // Get platform statistics
    public fun get_platform_stats(registry: &DropletRegistry): (u64, u64) {
        (registry.total_droplets_created, registry.fee_percentage)
    }

    // Get user history (combined - existing function)
    public fun get_user_history(registry: &DropletRegistry, user: address): (vector<String>, vector<String>) {
        let created = if (table::contains(&registry.user_created_droplets, user)) {
            *table::borrow(&registry.user_created_droplets, user)
        } else {
            vector::empty<String>()
        };
        
        let claimed = if (table::contains(&registry.user_claimed_droplets, user)) {
            *table::borrow(&registry.user_claimed_droplets, user)
        } else {
            vector::empty<String>()
        };
        
        (created, claimed)
    }

    

    // Get user's created droplets only
    public fun get_user_created_droplets(registry: &DropletRegistry, user: address): vector<String> {
        if (table::contains(&registry.user_created_droplets, user)) {
            *table::borrow(&registry.user_created_droplets, user)
        } else {
            vector::empty<String>()
        }
    }

    // Get user's claimed droplets only
    public fun get_user_claimed_droplets(registry: &DropletRegistry, user: address): vector<String> {
        if (table::contains(&registry.user_claimed_droplets, user)) {
            *table::borrow(&registry.user_claimed_droplets, user)
        } else {
            vector::empty<String>()
        }
    }

    // Get count of droplets created by user
    public fun get_user_created_count(registry: &DropletRegistry, user: address): u64 {
        if (table::contains(&registry.user_created_droplets, user)) {
            let droplets = table::borrow(&registry.user_created_droplets, user);
            vector::length(droplets)
        } else {
            0
        }
    }

    // Get count of droplets claimed by user
    public fun get_user_claimed_count(registry: &DropletRegistry, user: address): u64 {
        if (table::contains(&registry.user_claimed_droplets, user)) {
            let droplets = table::borrow(&registry.user_claimed_droplets, user);
            vector::length(droplets)
        } else {
            0
        }
    }

    // Get user's complete activity summary
    public fun get_user_activity_summary(registry: &DropletRegistry, user: address): (vector<String>, vector<String>, u64, u64) {
        let created = get_user_created_droplets(registry, user);
        let claimed = get_user_claimed_droplets(registry, user);
        let created_count = vector::length(&created);
        let claimed_count = vector::length(&claimed);
        
        (created, claimed, created_count, claimed_count)
    }

    // Check if user has any droplet activity
    public fun user_has_activity(registry: &DropletRegistry, user: address): bool {
        table::contains(&registry.user_created_droplets, user) || 
        table::contains(&registry.user_claimed_droplets, user)
    }

   
    public fun get_user_created_droplets_paginated(
        registry: &DropletRegistry, 
        user: address, 
        offset: u64, 
        limit: u64
    ): vector<String> {
        if (!table::contains(&registry.user_created_droplets, user)) {
            return vector::empty<String>()
        };
        
        let all_droplets = table::borrow(&registry.user_created_droplets, user);
        let total_length = vector::length(all_droplets);
        
        if (offset >= total_length) {
            return vector::empty<String>()
        };
        
        let mut result = vector::empty<String>();
        let end = if (offset + limit > total_length) { total_length } else { offset + limit };
        let mut i = offset;
        
        while (i < end) {
            vector::push_back(&mut result, *vector::borrow(all_droplets, i));
            i = i + 1;
        };
        
        result
    }

    // Get paginated user claimed droplets (for large histories)
    public fun get_user_claimed_droplets_paginated(
        registry: &DropletRegistry, 
        user: address, 
        offset: u64, 
        limit: u64
    ): vector<String> {
        if (!table::contains(&registry.user_claimed_droplets, user)) {
            return vector::empty<String>()
        };
        
        let all_droplets = table::borrow(&registry.user_claimed_droplets, user);
        let total_length = vector::length(all_droplets);
        
        if (offset >= total_length) {
            return vector::empty<String>()
        };
        
        let mut result = vector::empty<String>();
        let end = if (offset + limit > total_length) { total_length } else { offset + limit };
        let mut i = offset;
        
        while (i < end) {
            vector::push_back(&mut result, *vector::borrow(all_droplets, i));
            i = i + 1;
        };
        
        result
    }

    

    // Get droplet claimers list
    public fun get_claimers<CoinType>(droplet: &Droplet<CoinType>): (vector<address>, vector<String>) {
        (droplet.claimers_list, droplet.claimer_names)
    }

    // Check if address has claimed from droplet
    public fun has_claimed<CoinType>(droplet: &Droplet<CoinType>, addr: address): bool {
        table::contains(&droplet.claimed, addr)
    }

    // Get remaining balance in droplet
    public fun get_remaining_balance<CoinType>(droplet: &Droplet<CoinType>): u64 {
        coin::value(&droplet.coin)
    }

    // Check if droplet is expired
    public fun is_expired<CoinType>(droplet: &Droplet<CoinType>, clock: &Clock): bool {
        let current_time = clock::timestamp_ms(clock);
        current_time >= droplet.expiry_time
    }

    // Get droplet address by ID
    public fun get_droplet_address(registry: &DropletRegistry, droplet_id: String): Option<address> {
        if (table::contains(&registry.droplets, droplet_id)) {
            option::some(*table::borrow(&registry.droplets, droplet_id))
        } else {
            option::none<address>()
        }
    }

    // Find droplet by 6-character ID (returns address if found)
    public fun find_droplet_by_id(registry: &DropletRegistry, droplet_id: String): Option<address> {
        assert!(string::length(&droplet_id) == 6, E_INVALID_DROPLET_ID);
        get_droplet_address(registry, droplet_id)
    }

    // Get current fee percentage
    public fun get_fee_percentage(registry: &DropletRegistry): u64 {
        registry.fee_percentage
    }