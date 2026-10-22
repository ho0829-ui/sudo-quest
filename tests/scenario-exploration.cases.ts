/** 정답 목록에서 추출하지 않은 조사/오조치/대체 풀이. 플레이어의 다른 접근을 검증한다. */
export interface ExplorationCase { inspect: string[]; unrelated: string[]; alternative: string[] }
const sg = "sg-0f1e2d3c4b5a69788";
const tg = "arn:aws:elasticloadbalancing:ap-northeast-2:123456789012:targetgroup/shop-tg/73e2d6bc24d8a067";

export const explorations: Record<string, ExplorationCase> = {
  "linux-disk-full": {
    inspect: ["du -h --max-depth=1 /var/log", "journalctl --unit=nginx.service --lines=3", "ls -lah /var/log/app", "systemctl is-active nginx.service"],
    unrelated: ["sudo rm -f /tmp/missing", "sudo systemctl restart nginx"],
    alternative: ["sudo rm -rf /var/log/app", "sudo systemctl start nginx.service"],
  },
  "linux-permission": {
    inspect: ["curl -i http://localhost", "ls -lah /var/www/html", "cat /var/log/nginx/error.log | grep -i denied", "ss -ltnp"],
    unrelated: ["sudo systemctl restart nginx", "sudo chmod 600 /var/www/html/index.html"],
    alternative: ["sudo chmod a+r /var/www/html/index.html", "curl --head http://localhost"],
  },
  "linux-port-conflict": {
    inspect: ["ss -ltnp | grep :80", "ps aux | grep python", "nginx -T", "journalctl -u nginx.service | tail -n 3"],
    unrelated: ["sudo systemctl start nginx", "sudo kill 99999"],
    alternative: ["sudo kill -9 4127", "sudo systemctl restart nginx.service"],
  },
  "linux-oom": {
    inspect: ["free -h", "ps aux | sort -nr | head -n 5", "dmesg -T | grep -i oom", "journalctl -u shop-api.service --lines=2"],
    unrelated: ["sudo systemctl restart nginx", "sudo kill 99999"],
    alternative: ["sudo kill -15 5218", "sudo systemctl restart shop-api.service"],
  },
  "network-firewall": {
    inspect: ["curl -i http://localhost", "ss -ltnp | grep :80", "sudo ufw status verbose", "journalctl | grep UFW"],
    unrelated: ["sudo ufw allow 443/tcp", "sudo systemctl restart nginx"],
    alternative: ["sudo ufw allow http", "sudo ufw status"],
  },
  "network-dns": {
    inspect: ["cat /etc/hosts", "cat /etc/resolv.conf | grep nameserver", "ping -c 1 203.0.113.40", "dig shop.example.com"],
    unrelated: ["sudo systemctl restart shop-api", "sudo sed -i 's/never-match/anything/' /etc/resolv.conf"],
    alternative: ["sudo sed --in-place 's/10.0.0.53/10.0.0.2/g' /etc/resolv.conf", "curl --head https://api.payments.example.com"],
  },
  "network-bind-localhost": {
    inspect: ["ss -ltnp | grep 3000", "curl -i http://127.0.0.1:3000", "cat /opt/app/config.yml | grep host", "ps aux | grep node"],
    unrelated: ["sudo ufw allow 3000/tcp", "sudo systemctl restart shop-api"],
    alternative: ["sudo sed --in-place 's/127.0.0.1/0.0.0.0/' /opt/app/config.yml", "sudo systemctl stop shop-api", "sudo systemctl start shop-api"],
  },
  "web-nginx-config": {
    inspect: ["nginx -T", "cat /etc/nginx/nginx.conf | grep server_name", "systemctl is-active nginx", "journalctl -xeu nginx.service"],
    unrelated: ["sudo systemctl start nginx", "sudo systemctl reload nginx"],
    alternative: ["sudo sed --in-place 's/server_name shop.example.com/server_name shop.example.com;/g' /etc/nginx/nginx.conf", "sudo systemctl start nginx"],
  },
  "web-ssl-expired": {
    inspect: ["curl -I http://shop.example.com", "openssl s_client -connect shop.example.com:443", "openssl x509 -dates -noout -in /etc/letsencrypt/live/shop.example.com/fullchain.pem", "journalctl | grep certbot"],
    unrelated: ["sudo systemctl restart nginx", "sudo certbot certificates"],
    alternative: ["sudo certbot renew --force-renewal", "sudo systemctl reload nginx"],
  },
  "db-max-connections": {
    inspect: ["mysql -e \"SHOW GLOBAL VARIABLES LIKE 'max_%'\"", "mysql --execute=\"SHOW STATUS LIKE 'Threads%'\"", "mysql -e 'SHOW FULL PROCESSLIST' | head -n 3", "tail -n 8 /var/log/app/shop-api.log | grep -i connection"],
    unrelated: ["mysql -e 'SET GLOBAL wait_timeout = 60'", "sudo systemctl restart shop-api"],
    alternative: ["mysql --execute=\"SET GLOBAL max_connections = 250;\"", "mysql -e \"SHOW VARIABLES LIKE 'max_connections'\""],
  },
  "aws-security-group": {
    inspect: ["aws ec2 describe-instances", `aws ec2 describe-security-groups --group-ids ${sg}`, "aws sts get-caller-identity", "journalctl | grep -i ssh"],
    unrelated: [`aws ec2 authorize-security-group-ingress --group-id ${sg} --protocol tcp --port 80 --cidr 10.0.1.0/24`],
    alternative: [`aws ec2 authorize-security-group-ingress --cidr 10.0.1.0/24 --port 22 --protocol tcp --group-id ${sg}`],
  },
  "aws-alb-healthcheck": {
    inspect: ["aws elbv2 describe-load-balancers", `aws elbv2 describe-target-groups --target-group-arns ${tg}`, `aws elbv2 describe-target-health --target-group-arn ${tg}`, "journalctl -n 5"],
    unrelated: [`aws elbv2 modify-target-group --target-group-arn ${tg} --health-check-path /does-not-exist`],
    alternative: [`aws elbv2 modify-target-group --health-check-path /health --target-group-arn ${tg}`],
  },
  "aws-iam-s3": {
    inspect: ["aws iam list-roles", "aws iam list-attached-role-policies --role-name shop-web-role", "cat /var/log/app/upload.log | grep -i denied", "aws ec2 describe-instances"],
    unrelated: ["aws iam attach-role-policy --role-name shop-web-role --policy-arn arn:aws:iam::aws:policy/AmazonS3ReadOnlyAccess"],
    alternative: ["aws iam attach-role-policy --policy-arn=arn:aws:iam::aws:policy/AmazonS3FullAccess --role-name=shop-web-role"],
  },
  "kubernetes-image-pull": {
    inspect: ["kubectl get po -o wide", "kubectl describe deploy/shop-web", "kubectl get svc --output=wide", "kubectl get events | grep Failed"],
    unrelated: ["kubectl set image deploy/status-page status=registry.example.com/status:1.0.0", "kubectl set image deploy/shop-web web=missing:1"],
    alternative: ["kubectl set image deploy/shop-web web=registry.example.com/shop/web:1.4.2", "kubectl rollout status deploy/shop-web"],
  },
  "kubernetes-crashloop": {
    inspect: ["kubectl get po -o wide", "kubectl describe deploy/order-api", "kubectl logs order-api-0000000002-00002 --previous",
      "kubectl logs deploy/order-api --tail=1", "kubectl set env deploy/order-api --list", "kubectl get events | grep BackOff",
      "kubectl rollout history deploy/order-api", "cat /home/ubuntu/order-api/CHANGELOG.md | grep PAYMENT"],
    unrelated: ["kubectl set env deploy/payment-gateway PAYMENT_API_URL=http://payment-gateway:8080",
      "kubectl set resources deploy/order-api --limits=memory=1Gi", "kubectl set env deploy/order-api DB_HOST-"],
    alternative: ["kubectl rollout undo deploy/order-api", "kubectl rollout status deploy/order-api"],
  },
  "kubernetes-oom": {
    inspect: ["kubectl get pods -o wide", "kubectl describe deploy catalog-api", "kubectl logs deploy/catalog-api -p", "kubectl get events",
      "kubectl get nodes", "kubectl rollout history deployment/catalog-api", "ls /home/ubuntu", "kubectl set env deployment/catalog-api --list"],
    unrelated: ["kubectl set resources deployment/catalog-api --requests=memory=100Mi",
      "kubectl set resources deployment/catalog-api -c api --limits=memory=256Mi",
      "kubectl set image deployment/catalog-api api=registry.example.com/shop/catalog-api:3.1.0"],
    alternative: ["kubectl rollout undo deployment/catalog-api --to-revision=1", "kubectl rollout status deployment/catalog-api",
      "kubectl rollout history deployment/catalog-api"],
  },
  "docker-port-allocated": {
    inspect: ["docker container ls -a", "docker ps --format '{{.Names}} {{.Status}}'", "docker images shop-api", "docker logs shop-api-2.0.3 --tail 2",
      "docker port shop-api-2.0.3", "curl -i http://localhost:8080/api/coupons", "ss -tlnp | grep 8080", "ps aux | grep docker-proxy",
      "grep -n allocated /var/log/deploy/shop-api.log"],
    unrelated: ["docker restart shop-api-2.0.3", "docker start shop-api-2.1.0", "sudo systemctl restart docker", "sudo systemctl restart nginx"],
    alternative: ["docker rm -f shop-api-2.0.3 shop-api-2.1.0",
      "docker run -d --name shop-api --restart unless-stopped -p 8080:8080 --env-file /opt/shop-api/shop-api.env shop-api:2.1.0",
      "curl -s localhost:8080/version"],
  },
  "docker-missing-env": {
    inspect: ["docker ps -aq", "docker container ls --all", "docker logs --tail 1 notify-worker", "docker inspect -f '{{json .Config.Env}}' notify-worker",
      "docker inspect -f '{{.HostConfig.RestartPolicy.Name}}' notify-worker", "docker logs notify-worker | grep -c FATAL", "ls -l /opt/notify"],
    unrelated: ["docker restart notify-worker", "docker start notify-worker", "sudo systemctl restart docker",
      "docker run -d --name notify-worker-2 -e SMTP_PASSWORD notify-worker:1.4.0"],
    alternative: ["docker rm -f notify-worker",
      "docker run -d --name notify-worker --restart=on-failure:5 -e SMTP_HOST=smtp.example.com -e SMTP_USER=noreply@shop.example.com -e SMTP_PASSWORD=from-vault -e QUEUE_URL=redis://queue.internal:6379/0 notify-worker:1.4.0"],
  },
  "kubernetes-readiness": {
    inspect: ["kubectl get po -o wide", "kubectl get pods -l app=search-api --show-labels", "kubectl describe deploy search-api",
      "kubectl get events | grep Unhealthy", "kubectl logs deploy/search-api --tail=1", "kubectl describe svc search-api",
      "kubectl get endpointslices -l kubernetes.io/service-name=search-api", "grep -n healthz /home/ubuntu/search-api/RELEASE_NOTES.md"],
    unrelated: [`kubectl patch deployment search-api -p '{"spec":{"template":{"spec":{"containers":[{"name":"api","readinessProbe":{"httpGet":{"path":"/healthz","port":8081}}}]}}}}'`,
      "kubectl set resources deployment/search-api --limits=memory=1Gi", `kubectl patch deployment search-api -p '{"spec":{"replicas":3}}'`,
      "kubectl set selector svc search-api app=search"],
    alternative: ["kubectl rollout undo deployment/search-api", "kubectl rollout status deploy/search-api"],
  },
  "kubernetes-service-selector": {
    inspect: ["kubectl get svc -o wide", "kubectl get ep payment", "kubectl get endpointslices -l kubernetes.io/service-name=payment",
      "kubectl describe deploy payment-api", "kubectl get pods -l app.kubernetes.io/name=payment-api", "kubectl describe svc payment | grep Selector",
      "kubectl logs deploy/payment-api", "cat /home/ubuntu/payment-api/MIGRATION.md"],
    unrelated: [`kubectl patch svc payment -p '{"spec":{"selector":{"app.kubernetes.io/name":"payment-api"}}}'`, "kubectl rollout undo deployment/payment-api",
      "kubectl set selector deployment payment-api app=payment",
      `kubectl patch deployment payment-api -p '{"spec":{"template":{"metadata":{"labels":{"app.kubernetes.io/name":"payment"}}}}}'`],
    alternative: [`kubectl patch svc payment -p '{"spec":{"selector":{"app":null,"app.kubernetes.io/name":"payment-api"}}}'`, "kubectl get endpoints payment"],
  },
  "docker-disk-full": {
    inspect: ["df -h /var/lib/docker", "sudo du -sh /var/lib/docker/overlay2", "docker system df", "docker image ls --filter dangling=true",
      "docker images shop-api", "docker ps -a --format '{{.Names}} {{.Status}}'", "journalctl -u docker", "cat /opt/deploy/build.sh",
      "grep -c 'no space' /var/log/deploy/build-2.2.0.log"],
    unrelated: ["docker image prune -a", "docker container prune -f", "docker image prune -f", "sudo rm -rf /var/log/nginx",
      "docker run -d --name probe nginx:1.25-alpine", "docker restart shop-api", "sudo rm -rf /var/lib/docker/overlay2"],
    alternative: ["docker system prune -a -f", "docker system df"],
  },
};
