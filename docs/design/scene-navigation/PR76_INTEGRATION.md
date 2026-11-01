# PR #76 场景化导航集成记录 · 2026-11-01

- Starting Head：`7eb2af6d3d56ec4074f634b5d66b0c6a00caf0ad`。
- 导航原始本地 Head：`b4063df0f023946830a1387bee435ae5b05868d9`，开始时导航未提交。
- 先封装导航原始提交：`c5d21563646c2773980bb468da8045732bb3c8b5`。
- 最终集成基线：`0fbac3470dff473ceaa31df16f937cff1cf3c484`。期间远端持续推进，已依次保留新提交并在最新基线重新验证。
- 通过 `cherry-pick --no-commit` 迁移。唯一冲突是 `site-header.tsx`：完整保留最新 `InfoPageHeader`、中文路径归一化及所有标准页头逻辑，仅接入原首页导航包装层。
- 正式导航组件、CSS、账户/隐私展示变体及 27 个素材均与原导航提交字节一致。没有重新开发、重新设计或修改业务。

## 最新基线验证

- Build / TypeScript：PASS。
- 全量单元测试：146 文件、980 项 PASS（包含导航、账户、语言路由和隐私测试）。
- Lint：0 error，2 条原有 Hexagrams 图片警告。
- 浏览器：91 项 PASS；默认、Other Methods、Info 三态均成功采集，与原验收版导航几何最大偏差 0px。
- 英文与中文导航 href、语言切换、键盘/焦点、原 Privacy Settings 以及最新中英文 Info 页头均验证通过。
- `git diff --check`：PASS；没有未解决冲突。

完整最新验证记录位于 `evidence/2026-11-01/`，旧视觉终验材料保留在 `evidence/2026-10-30/`。三态完整截图和局部对照均随本次提交进入 Git。第一次 browser gate 将同名 Help & Support 标题/链接混淆，已在测试中以原字体信息消除歧义；生产导航代码未改。首次诊断记录保留，没有将其冒称通过。

原始临时 `.artifacts` 文件仍保留在来源工作区，未删除或一并推送。迁移前 `7eb2af6` 的 Reading 测试夹具类型错误由远端后续提交修复，本任务未修改该夹具。

范围不含 API、数据库、起卦、详情页主体、其他业务、依赖、配置或工作流。没有新建 PR、长期分支、merge main、force push 或执行部署。推送结果通过提交后的远端 PR Head 与 Git tree 再次核验。
