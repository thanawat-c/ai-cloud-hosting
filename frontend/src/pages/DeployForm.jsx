import { useState } from 'react';
import { Rocket, GitBranch, Terminal, CheckCircle2, XCircle, ExternalLink, Sparkles, Key, Eye, EyeOff, Lock } from 'lucide-react';

const DeployForm = () => {
  const [repoUrl, setRepoUrl] = useState('');
  const [gitToken, setGitToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [containerId, setContainerId] = useState('');
  const [aiDockerfile, setAiDockerfile] = useState(''); 
  const [publicPort, setPublicPort] = useState('');
  const [deployLogs, setDeployLogs] = useState('');
  const [envVars, setEnvVars] = useState("");
  const [forceAi, setForceAi] = useState(false);

    const handleDeploy = async () => {
    if (!repoUrl) {
      alert("กรุณาใส่ลิงก์ GitHub ก่อนครับ!");
      return;
    }

    setIsLoading(true);
    setMessage('');
    setAiDockerfile('');
    setContainerId('');
    setPublicPort('');
    setDeployLogs(''); // ล้างหน้าจอ Terminal

    try {
      const response = await fetch('http://localhost:8080/api/test-deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          repo_url: repoUrl, 
          env_vars: envVars, 
          force_ai: forceAi,
          git_token: gitToken.trim()
        })
      });
      
      // เครื่องมือสำหรับอ่านข้อมูลแบบ Stream (สตรีมมิ่ง)
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullLog = '';

      while (true) {
        // รอรับข้อมูลชิ้นใหม่ที่ Backend ดันผ่านท่อมา
        const { value, done } = await reader.read();
        if (done) break; // ถ้า Backend บอกว่า "จบแล้วท่อปิด" ก็ให้หยุด
        
        // ถอดรหัสข้อมูลและนำไปต่อท้ายข้อความเดิม
        const chunk = decoder.decode(value, { stream: true });
        fullLog += chunk;
        setDeployLogs(fullLog); // อัปเดตหน้าจอทันที
        
        // แอบเช็คว่าถ้ามีคำว่า SUCCESS โผล่มา แปลว่ารันเสร็จแล้ว
        if (chunk.includes("SUCCESS: DOMAIN=")) {
          const domainMatch = chunk.match(/DOMAIN=([a-zA-Z0-9.-]+)/);
          const idMatch = chunk.match(/ID=([a-zA-Z0-9]+)/);
          
          if (domainMatch) setPublicPort(domainMatch[1]); // เก็บโดเมนเนมไว้ในตัวแปรเดิมไปก่อน จะได้แก้ไม่เยอะ
          if (idMatch) setContainerId(idMatch[1]); // ต้อง set ค่านี้ด้วย UI ถึงจะเปลี่ยนเป็นสีเขียว!
          
          setMessage("Deploy สำเร็จ! เซิร์ฟเวอร์ของคุณพร้อมใช้งานแล้ว");
        } else if (chunk.includes("Error:")) { // เอาอีโมจิออกตามที่แก้ใน Go
          setMessage("การ Deploy ล้มเหลว โปรดดู Log ด้านล่าง");
        }
      }
    } catch (error) {
      setMessage("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <div className="max-w-3xl mx-auto mt-4">
      <div className="bg-white/70 backdrop-blur-2xl p-8 md:p-10 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/50 relative overflow-hidden">
        
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 -mt-20 -mr-20 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 -mb-20 -ml-20 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
        
        <div className="relative z-10 text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-xl shadow-blue-500/30 mb-6">
            <Rocket className="w-8 h-8" />
          </div>
          <h3 className="text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent mb-3">Deploy New Project</h3>
          <p className="text-slate-500 max-w-md mx-auto">Paste your GitHub repository URL and let our AI magically analyze, containerize, and deploy it for you.</p>
        </div>
        
        
        <div className="relative z-10 space-y-6">
          <div className="mt-4">
  <label className="block text-sm font-medium text-slate-700 mb-2">
    Environment Variables (Optional)
  </label>
  <textarea
    value={envVars}
    onChange={(e) => setEnvVars(e.target.value)}
    placeholder={"DB_PASSWORD=secret\nAPI_KEY=12345\nPORT=3000"}
    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
    rows="4"
  ></textarea>
  <p className="text-xs text-slate-500 mt-1">
    ใส่บรรทัดละ 1 ตัวแปร รูปแบบ KEY=VALUE (ตัวอย่างการวางไฟล์ .env)
  </p>
</div>

          <div className="group">
            <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
              GitHub Repository URL
            </label>
            <div className="relative">
              <input 
                type="text" 
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                placeholder="https://github.com/username/project" 
                className="w-full bg-slate-50/50 border border-slate-200 text-slate-800 px-5 py-4 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/15 focus:border-blue-500 transition-all shadow-sm text-base placeholder:text-slate-400" 
              />
            </div>
          </div>

          {/* GitHub Personal Access Token (for Private Repos) */}
          <div className="group">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-semibold text-slate-700 flex items-center gap-2">
                <Lock className="w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                GitHub Personal Access Token <span className="text-xs font-normal text-slate-400">(Optional - สำหรับ Private Repo)</span>
              </label>
            </div>
            <div className="relative">
              <input 
                type={showToken ? "text" : "password"} 
                value={gitToken}
                onChange={(e) => setGitToken(e.target.value)}
                placeholder="ghp_xxxxxxxxxxxx หรือ github_pat_xxxx" 
                className="w-full bg-slate-50/50 border border-slate-200 text-slate-800 pl-5 pr-12 py-3.5 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/15 focus:border-blue-500 transition-all shadow-sm text-sm font-mono placeholder:text-slate-400 placeholder:font-sans" 
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1"
                title={showToken ? "ซ่อน Token" : "แสดง Token"}
              >
                {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-1.5 flex items-center gap-1.5">
              <span>🔒 ข้อมูล Token จะถูกเข้ารหัสส่งผ่าน HTTPS และไม่แสดงใน Log ของระบบ (ใช้สิทธิ์ read-only: `repo`)</span>
            </p>
          </div>
          
          {/* Checkbox Force AI Override */}
          <div className="flex items-center gap-3 p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl text-left">
            <input 
              type="checkbox" 
              id="forceAi"
              checked={forceAi}
              onChange={(e) => setForceAi(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
            />
            <label htmlFor="forceAi" className="text-sm font-medium text-slate-700 cursor-pointer select-none">
              <span className="font-semibold text-blue-600">Force AI Override:</span> บังคับให้ AI เขียน Dockerfile ทับของเดิมเสมอ (แนะนำหากโปรเจกต์เดิม Build ไม่ผ่าน)
            </label>
          </div>

          <button 
            onClick={handleDeploy}
            disabled={isLoading}
            className={`w-full group relative overflow-hidden flex items-center justify-center gap-3 font-semibold py-4 px-6 rounded-xl transition-all duration-300 shadow-lg
              ${isLoading 
                ? 'bg-slate-200 text-slate-500 cursor-not-allowed shadow-none' 
                : 'bg-gradient-to-r from-slate-900 to-slate-800 hover:from-slate-800 hover:to-slate-700 text-white shadow-slate-900/20 hover:shadow-xl hover:shadow-slate-900/30 hover:-translate-y-0.5'}`}
          >
            {isLoading ? (
              <>
                <div className="w-5 h-5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div>
                AI Analyzing & Building...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5 text-blue-400 group-hover:text-blue-300 transition-colors" />
                Analyze & Deploy
              </>
            )}
          </button>

          {/* Terminal Log View (จะโชว์เฉพาะตอนที่มี Log) */}
          {deployLogs && (
            <div className="mt-8 bg-slate-900 rounded-xl p-4 overflow-hidden border border-slate-700 shadow-2xl text-left">
              {/* จุดสีๆ หัวหน้าต่างเหมือนของ Mac */}
              <div className="flex items-center gap-2 mb-3 border-b border-slate-800 pb-2">
                <div className="w-3 h-3 rounded-full bg-rose-500"></div>
                <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                <span className="text-slate-400 text-xs font-mono ml-2">Deploy Terminal</span>
              </div>
              
              {/* พื้นที่โชว์ตัวหนังสือ (ใส่สีเขียวแบบ Hacker) */}
              <div className="h-64 overflow-y-auto font-mono text-xs md:text-sm text-emerald-400 whitespace-pre-wrap">
                {deployLogs}
              </div>
            </div>
          )}

          {/* Success/Error Message */}
          {message && (
            <div className={`mt-8 p-6 rounded-2xl border backdrop-blur-sm animate-in fade-in slide-in-from-bottom-4 duration-500
              ${containerId 
                ? 'bg-emerald-50/80 border-emerald-200/60' 
                : 'bg-rose-50/80 border-rose-200/60'}`}>
              
              <div className="flex items-start gap-4">
                {containerId ? (
                  <CheckCircle2 className="w-6 h-6 text-emerald-500 shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-6 h-6 text-rose-500 shrink-0 mt-0.5" />
                )}
                
                <div className="flex-1">
                  <h4 className={`text-lg font-bold mb-1 ${containerId ? 'text-emerald-800' : 'text-rose-800'}`}>
                    {containerId ? 'Deployment Successful!' : 'Deployment Failed'}
                  </h4>
                  <p className={`font-medium ${containerId ? 'text-emerald-700' : 'text-rose-700'}`}>{message}</p>
                  
                  {containerId && (
                    <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-4">
                      <code className="text-sm px-3 py-1.5 bg-emerald-100/50 text-emerald-800 rounded-lg border border-emerald-200 font-mono">
                        ID: {containerId.substring(0, 12)}
                      </code>
                      
                      {publicPort && (
                        <a 
                          href={`http://${publicPort}`} 
                          target="_blank" 
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold transition-all shadow-md shadow-emerald-500/20 hover:shadow-lg hover:-translate-y-0.5"
                        >
                          Open Live Site <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Dockerfile Output (macOS Terminal Style) */}
          {aiDockerfile && (
            <div className="mt-8 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-150">
              <div className="flex items-center gap-2 mb-3 px-2">
                <Terminal className="w-5 h-5 text-indigo-500" />
                <h4 className="text-sm font-bold text-slate-700">AI Generated Dockerfile</h4>
              </div>
              
              <div className="rounded-2xl overflow-hidden shadow-2xl shadow-slate-900/20 border border-slate-800 bg-[#1e1e1e]">
                {/* macOS Window Header */}
                <div className="bg-[#2d2d2d] border-b border-black/20 px-4 py-3 flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-[#ff5f56] border border-[#e0443e]"></div>
                    <div className="w-3 h-3 rounded-full bg-[#ffbd2e] border border-[#dea123]"></div>
                    <div className="w-3 h-3 rounded-full bg-[#27c93f] border border-[#1aab29]"></div>
                  </div>
                  <div className="flex-1 text-center text-xs text-slate-400 font-medium">Dockerfile</div>
                </div>
                
                <div className="p-5 overflow-x-auto">
                  <pre className="text-[13px] leading-relaxed font-mono text-[#d4d4d4]">
                    <code>{aiDockerfile}</code>
                  </pre>
                </div>
              </div>
            </div>
          )}

        </div>
        
      </div>
    </div>
  );
};

export default DeployForm;