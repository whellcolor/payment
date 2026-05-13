import os
import zipfile

project_name = "web3-mining-dapp"

def zipdir(path, ziph):
    for root, dirs, files in os.walk(path):
        for file in files:
            filepath = os.path.join(root, file)
            ziph.write(filepath)

with zipfile.ZipFile(project_name + ".zip", "w", zipfile.ZIP_DEFLATED) as zipf:
    zipdir(project_name, zipf)

print("ZIP CREATED:", project_name + ".zip")

