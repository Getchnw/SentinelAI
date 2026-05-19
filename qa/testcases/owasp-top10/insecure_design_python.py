def checkout_cart(cart_items, client_provided_price):
    # Vulnerable: Trusting the price provided by the client instead of calculating it server-side
    total_amount = client_provided_price
    
    # Process payment with the potentially manipulated price
    process_payment(total_amount)
    return f"Payment of {total_amount} processed."

def process_payment(amount):
    pass
