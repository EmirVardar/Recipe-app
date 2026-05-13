import io
import torch
import torch.nn as nn
from torchvision import transforms, models
from fastapi import FastAPI, File, UploadFile
from PIL import Image

app = FastAPI()

CKPT = torch.load("best_model_v3.pth", map_location="cpu", weights_only=False)
CLASS_NAMES = CKPT["class_names"]
# idx_to_class anahtarları int veya string olabilir, her ikisini de destekle
_raw = CKPT.get("idx_to_class", {})
IDX_TO_CLASS = {int(k): v for k, v in _raw.items()} if _raw else {i: c for i, c in enumerate(CLASS_NAMES)}

model = models.resnet18(weights=None)
model.fc = nn.Linear(model.fc.in_features, len(CLASS_NAMES))
model.load_state_dict(CKPT["model_state_dict"])
model.eval()

transform = transforms.Compose([
    transforms.Resize(256),
    transforms.CenterCrop(224),
    transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406],
                         [0.229, 0.224, 0.225]),
])

@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    contents = await file.read()
    image = Image.open(io.BytesIO(contents)).convert("RGB")
    tensor = transform(image).unsqueeze(0)

    with torch.no_grad():
        outputs = model(tensor)
        probs = torch.softmax(outputs, dim=1)
        confidence, idx = torch.max(probs, 1)

    return {
        "food_name": IDX_TO_CLASS[idx.item()],
        "confidence": round(confidence.item(), 3)
    }

@app.get("/health")
def health():
    return {"status": "ok", "classes": len(CLASS_NAMES)}
