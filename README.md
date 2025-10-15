# BoxLayout3D
박스추가편집3dUI

## 다운로드 방법

1. **Git으로 클론하기**
   ```bash
   git clone https://github.com/<YOUR_ACCOUNT>/BoxLayout3D.git
   cd BoxLayout3D
   ```
2. **ZIP으로 받기**
   1. GitHub 페이지에서 **Code → Download ZIP**을 클릭합니다.
   2. 압축을 해제한 뒤, 해당 폴더로 이동합니다.

## 실행 방법

이 프로젝트는 별도의 빌드 과정 없이 정적 파일만으로 동작합니다. 아래 방법 중 하나를 선택해서 `index.html`을 웹 브라우저에서 열면 됩니다.

## 프로젝트 구성

```
BoxLayout3D/
├── index.html   # 메인 UI와 3D 뷰포트를 렌더링하는 정적 문서
├── styles.css   # 전체 UI 레이아웃 및 패널/버튼 스타일 정의
└── src/
    └── main.js  # Three.js 기반 상자 생성, 편집, 배치 로직
```

필요한 파일은 모두 이 저장소에 포함되어 있으므로 위 구조가 보이지 않는다면 최신 커밋을 받아 왔는지 확인하거나, `git status`로 파일이 추가되었는지 확인한 뒤 원격 저장소에 푸시하세요.

<<<<<<< HEAD
## GitHub에 올리는 방법

프로젝트를 직접 실행해볼 수 있도록 GitHub 원격 저장소에 코드를 업로드하고 싶다면 아래 순서를 따르면 됩니다.

1. **GitHub에 새 저장소 만들기**
   - GitHub에서 `New repository`를 선택해 빈 저장소를 만듭니다.
   - HTTPS 주소를 복사해 둡니다. 예: `https://github.com/<YOUR_ACCOUNT>/box-layout-demo.git`
2. **로컬 저장소에 원격 주소 등록**
   ```bash
   git remote add origin https://github.com/<YOUR_ACCOUNT>/box-layout-demo.git
   ```
   이미 `origin`이 있다면 이름을 바꾸거나 `git remote set-url origin <REMOTE_URL>`로 업데이트합니다.
3. **변경 사항 커밋**
   ```bash
   git add .
   git commit -m "Initial 3D box editor upload"
   ```
4. **GitHub로 푸시**
   ```bash
   git push -u origin main
   ```
   기본 브랜치 이름이 `master`라면 명령어의 `main`을 `master`로 바꿔주세요.
5. **GitHub Pages로 배포(선택)**
   - 리포지터리의 **Settings → Pages**에서 Source를 `Deploy from a branch`로 설정하고, `main` 브랜치의 `/ (root)`를 선택합니다.
   - 몇 분 후 `https://<YOUR_ACCOUNT>.github.io/<REPO_NAME>/` 주소로 접속하면 브라우저에서 바로 실행해볼 수 있습니다.

원격에 푸시한 뒤에는 `git status`로 작업 폴더가 깨끗(clean)한지 확인하면 됩니다.

=======
>>>>>>> main
### 1. 파일 직접 열기

1. 저장소를 클론하거나 다운로드합니다.
2. `index.html` 파일을 더블클릭하거나 브라우저에서 `파일 → 열기`로 선택합니다.
   - WebGL을 사용하는 프로젝트 특성상, 일부 브라우저에서는 로컬 파일 접근을 제한할 수 있습니다. 이 경우 아래의 간단한 웹 서버 실행 방법을 사용하세요.

### 2. 파이썬 내장 서버 사용 (권장)

1. 터미널에서 프로젝트 루트(`README.md`가 있는 폴더)로 이동합니다.
2. 다음 명령을 실행합니다.

   ```bash
   python3 -m http.server 5173
   ```

3. 브라우저에서 `http://localhost:5173` 에 접속합니다.

### 3. VS Code Live Server 등 정적 서버 사용

VS Code의 **Live Server** 확장이나 `npm`의 `serve`, `http-server` 같은 간단한 정적 서버를 이용해도 됩니다. 프로젝트 루트에서 서버를 실행하고, 제공되는 주소로 접속하면 됩니다.
