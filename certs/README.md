# TLS / SSL Certificates Provisioning Guide

This directory holds the SSL/TLS certificates mounted by Nginx in `docker-compose.yml`:
```yaml
volumes:
  - ./certs:/etc/nginx/certs:ro
```

Nginx expects two files inside `/etc/nginx/certs/`:
- `tls.crt`: Full certificate chain (PEM format)
- `tls.key`: RSA or ECDSA private key (PEM format)

---

## 1. Development Environment (Self-Signed Certificates)

For local development or testing with Docker Compose, generate a self-signed certificate using either helper script:

### Using PowerShell (Windows):
```powershell
./scripts/generate-dev-certs.ps1
```

### Using Bash (Linux / macOS):
```bash
./scripts/generate-dev-certs.sh
```

Or manually with OpenSSL:
```bash
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout certs/tls.key \
  -out certs/tls.crt \
  -subj "/CN=localhost/O=Kiro ERP/C=ID" \
  -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"
```

---

## 2. Production Environment (Let's Encrypt / Certbot)

For production deployment with a public domain (e.g. `erp.yourcompany.com`):

1. Provision certificates with Certbot:
   ```bash
   certbot certonly --standalone -d erp.yourcompany.com
   ```
2. Copy or symlink the live certificates into `certs/`:
   ```bash
   cp /etc/letsencrypt/live/erp.yourcompany.com/fullchain.pem ./certs/tls.crt
   cp /etc/letsencrypt/live/erp.yourcompany.com/privkey.pem ./certs/tls.key
   chmod 600 ./certs/tls.key
   chmod 644 ./certs/tls.crt
   ```

---

## 3. Production Environment (Enterprise External PKI)

If using corporate or wildcard certificates from DigiCert, Sectigo, Cloudflare, etc.:
1. Place the full certificate bundle into `certs/tls.crt`.
2. Place the private key into `certs/tls.key`.
3. Verify permissions:
   ```bash
   chmod 600 certs/tls.key
   chmod 644 certs/tls.crt
   ```

> [!CAUTION]
> Never commit `tls.key` or private keys to source control. Ensure `certs/*.key` is listed in `.gitignore`.
