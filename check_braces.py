filename = 'index.html'

with open(filename, 'r') as f:
    lines = f.readlines()

balance = 0
stack = []

for i, line in enumerate(lines):
    for char in line:
        if char == '{':
            balance += 1
            stack.append(i + 1)
        elif char == '}':
            balance -= 1
            if balance < 0:
                print(f"Error: Unexpected closing brace at line {i + 1}")
                exit()
            stack.pop()

if balance != 0:
    print(f"Error: Unclosed brace at line {stack[-1]}")
    print(f"Total balance: {balance}")
else:
    print("Braces are balanced.")
