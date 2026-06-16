import subprocess
import os

objects = [
    "6f99264990b969c525bdb816917f1d2bc0a4ca9a",
    "e3f31e9913c16bc9b8060d44e5931de392015a1e",
    "ea0364f4119f6790948de1925cac7d41590af080",
    "0efc0d8f115731b1e13c8a318eaf579ea55cf32c",
    "6fe4354f00e12df8ccdce7338a0a11b2f0d838ae",
    "4d86f76a7fc0393cb8ec32cc74a906e23aea30e5"
]

os.chdir(r"c:\Users\kmj\Sellnance")

for obj in objects:
    print(f"\n=================== Object: {obj} ===================")
    # Check type
    try:
        obj_type = subprocess.check_output(["git", "cat-file", "-t", obj]).decode().strip()
        print("Type:", obj_type)
        if obj_type in ["commit", "blob"]:
            # Show first 30 lines
            content = subprocess.check_output(["git", "show", obj]).decode("utf-8", errors="ignore")
            lines = content.splitlines()
            print("Lines count:", len(lines))
            for l in lines[:30]:
                print(l)
        elif obj_type == "tree":
            content = subprocess.check_output(["git", "ls-tree", obj]).decode("utf-8", errors="ignore")
            print(content)
    except Exception as e:
        print("Error:", e)
