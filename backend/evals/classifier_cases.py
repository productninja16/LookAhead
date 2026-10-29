"""Labelled intent-classifier set (US/USD).

(query, expected_intent, is_hard_edge)
"""

CASES = [
    # purchase_check (7)
    ("Can I buy a $1,500 phone right now?", "purchase_check", False),
    ("Is $85 too much for a dinner out this weekend?", "purchase_check", False),
    ("I need to pay $4,500 for car repair — it just broke down.", "purchase_check", False),
    ("Should I get the $549 headphones?", "purchase_check", False),
    ("Can I afford a $1,200 laptop on Affirm or should I pay upfront?", "purchase_check", False),
    ("Is a $300 concert ticket worth it this month?", "purchase_check", False),
    ("Can I afford to book a $900 flight to Denver?", "purchase_check", False),
    # conversational (11)
    ("What does safe-to-spend actually mean?", "conversational", False),
    ("If I got a raise to $9,000 a month, how would my safe-to-spend change?", "conversational", False),
    ("I'm thinking of cancelling my Spotify subscription.", "conversational", False),
    ("How does my emergency fund look?", "conversational", False),
    ("Why is my daily budget so low?", "conversational", False),
    ("Explain what buffer means", "conversational", False),
    ("What's the difference between a Roth IRA and a 401(k)?", "conversational", False),
    ("Thanks, that helps!", "conversational", False),
    ("How much do I have left until payday?", "conversational", False),
    ("What bills do I have coming up?", "conversational", False),
    ("Hi", "conversational", False),
    # tool_call (10)
    ("I paid my rent today.", "tool_call", False),
    ("I got a salary hike — I'm now making $8,500 a month.", "tool_call", False),
    ("I got a bonus of $2,000 this month.", "tool_call", False),
    ("My rent is now $1,900.", "tool_call", False),
    ("I just paid the car payment.", "tool_call", False),
    ("I cancelled my gym membership.", "tool_call", False),
    ("I received my tax refund of $1,400.", "tool_call", False),
    ("I paid $1,350 for rent.", "tool_call", False),
    ("I got a raise — I make $4,200 a month now.", "tool_call", False),
    ("I earn $95,000 a year now.", "tool_call", False),
    # hard edge cases (8)
    ("What if I bought a $1,000 laptop right now — could I afford it?", "conversational", True),
    ("I bought a $700 jacket yesterday. Was that a good decision?", "conversational", True),
    ("$1,500.", "conversational", True),
    ("I tend to impulse-buy electronics after a stressful week.", "semantic_update", True),
    ("What would happen if my rent went up to $2,000?", "conversational", True),
    ("I'm considering a $3,000 couch.", "conversational", True),
    ("How would a $200 monthly car payment affect me?", "conversational", True),
    ("I always overspend on food delivery.", "semantic_update", True),
]
