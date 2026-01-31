
import os

source_path = r'd:\dev\projects\zonds\zonds\packages\ui\dist\assets\logo.svg'
dest_path = r'd:\dev\projects\zonds\zonds\packages\ui\src\assets\logo.svg'

with open(source_path, 'r', encoding='utf-8') as f_src:
    lines = f_src.readlines()

with open(dest_path, 'w', encoding='utf-8') as f_dest:
    for i, line in enumerate(lines):
        line_num = i + 1
        if 5 <= line_num <= 10:
            continue
        f_dest.write(line)

print(f"Successfully created {dest_path} from {source_path} excluding lines 5-10.")
