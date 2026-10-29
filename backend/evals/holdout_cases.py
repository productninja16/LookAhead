"""Held-out queries written AFTER the rules were tuned on classifier_cases.py.

Reported separately so the headline accuracy isn't just the rules grading their own homework.
(query, expected_intent)
"""

HOLDOUT = [
    ("Would a $60 sweater put me over budget?", "purchase_check"),
    ("My brother's wedding gift: is $250 reasonable for me right now?", "purchase_check"),
    ("Thinking about leasing a $450/month car, should I?", "conversational"),
    ("Can I swing $2,200 for a used scooter?", "purchase_check"),
    ("Is it smart to pay $1,800 upfront for the annual gym plan?", "purchase_check"),
    ("what's my buffer", "conversational"),
    ("Do I have enough saved for a $5,000 vacation?", "purchase_check"),
    ("I paid off my credit card.", "tool_call"),
    ("Landlord raised my rent to $2,050.", "tool_call"),
    ("My Netflix is now $22.", "tool_call"),
    ("I stopped by the store and bought a $40 lamp.", "conversational"),
    ("Help me understand how the buffer is calculated", "conversational"),
    ("I overspend whenever I'm stressed.", "semantic_update"),
    ("Any advice on picking stocks?", "conversational"),
    ("I got a $3,000 bonus!", "tool_call"),
    ("Can I afford dinner?", "conversational"),
]
