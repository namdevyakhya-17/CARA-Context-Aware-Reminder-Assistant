# CARA Frontend

Static HTML, CSS, and JavaScript frontend for the CARA backend through Agent 4.

## Run

Start the FastAPI backend from the project root:

```powershell
python -m uvicorn main:app --reload
```

Serve the frontend from the `frontend` folder:

```powershell
cd frontend
python -m http.server 5500
```

Open:

```text
http://127.0.0.1:5500
```

The API URL field defaults to:

```text
http://127.0.0.1:8000
```

## Backend Note

If the browser blocks requests with a CORS error, allow the frontend origin in FastAPI or serve these files from the same origin as the API. The frontend itself does not implement Agent 5 and only calls the existing Agent 1 through Agent 4 endpoints.
