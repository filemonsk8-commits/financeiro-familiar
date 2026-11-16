(() => {
  "use strict";
  const cfg = window.FINANCEIRO_CONFIG || {};
  const $ = (id) => document.getElementById(id);
  const client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabasePublishableKey, {
    auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true }
  });
  const state = { user:null, household:null, membership:null, accounts:[], categories:[], transactions:[], bills:[], view:"home", signup:false };
  const money = new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"});
  const dateToday = () => {
    const d = new Date();
    return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10);
  };
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const fmtDate = (value) => value ? new Date(value+"T12:00:00").toLocaleDateString("pt-BR") : "—";
  const fmtMoney = (value) => money.format(Number(value || 0));
  const monthKey = dateToday().slice(0,7);
  const monthTransactions = () => state.transactions.filter(t => String(t.occurred_at).slice(0,7) === monthKey);
  function toast(message) {
    const el = $("toast"); el.textContent = message; el.classList.add("show");
    window.clearTimeout(toast.timer); toast.timer = window.setTimeout(()=>el.classList.remove("show"),3200);
  }
  function setNotice(id,message,type) {
    const el=$(id); if(!el)return; el.textContent=message||""; el.className="notice"+(type?" "+type:"");
  }
  function showAuth() {
    $("authScreen").hidden=false; $("setupScreen").hidden=true; $("appShell").hidden=true;
  }
  function showSetup() {
    $("authScreen").hidden=true; $("setupScreen").hidden=false; $("appShell").hidden=true;
    setNotice("setupMessage","");
  }
  function showApp() {
    $("authScreen").hidden=true; $("setupScreen").hidden=true; $("appShell").hidden=false;
    $("userLabel").textContent=state.user.email || "Minha conta";
    $("userAvatar").textContent=(state.user.email||"F").slice(0,1).toUpperCase();
    $("householdLabel").textContent=state.household.name;
    render();
  }
  async function loadWorkspace() {
    const {data:membership,error} = await client.from("household_members").select("household_id,role").eq("user_id",state.user.id).maybeSingle();
    if(error) throw error;
    if(!membership) { showSetup(); return; }
    state.membership=membership;
    const {data:household,error:houseError}=await client.from("households").select("id,name,currency").eq("id",membership.household_id).single();
    if(houseError) throw houseError;
    state.household=household;
    await loadData();
    showApp();
  }
  async function loadData() {
    const id=state.household.id;
    const results=await Promise.all([
      client.from("financial_accounts").select("*").eq("household_id",id).eq("is_active",true).order("created_at"),
      client.from("categories").select("*").eq("household_id",id).order("kind").order("name"),
      client.from("transactions").select("*").eq("household_id",id).order("occurred_at",{ascending:false}).limit(500),
      client.from("bills").select("*").eq("household_id",id).order("due_date")
    ]);
    for(const r of results) if(r.error) throw r.error;
    state.accounts=results[0].data||[]; state.categories=results[1].data||[];
    state.transactions=results[2].data||[]; state.bills=results[3].data||[];
    $("lastUpdated").textContent="Atualizado às "+new Date().toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"});
  }
  async function refresh() { try { await loadData(); render(); } catch(e) { toast("Não foi possível atualizar: "+e.message); } }
  function balanceStats() {
    const all=state.transactions; const current=monthTransactions();
    const income=all.filter(t=>t.kind==="income").reduce((s,t)=>s+Number(t.amount),0);
    const expense=all.filter(t=>t.kind==="expense").reduce((s,t)=>s+Number(t.amount),0);
    const monthIn=current.filter(t=>t.kind==="income").reduce((s,t)=>s+Number(t.amount),0);
    const monthOut=current.filter(t=>t.kind==="expense").reduce((s,t)=>s+Number(t.amount),0);
    const opening=state.accounts.reduce((s,a)=>s+Number(a.opening_balance||0),0);
    const pending=state.bills.filter(b=>b.status==="pending").reduce((s,b)=>s+Number(b.amount),0);
    return {balance:opening+income-expense,monthIn,monthOut,pending};
  }
  function statCard(label,value,icon,foot,extra) {
    return '<article class="stat-card"><div class="stat-top"><span>'+label+'</span><span class="stat-icon">'+icon+'</span></div><div class="stat-value '+(extra||"")+'">'+value+'</div><div class="stat-foot">'+foot+'</div></article>';
  }
  function transactionRows(list) {
    if(!list.length) return '<tr><td colspan="5"><div class="empty-state"><strong>Nenhum lançamento por aqui.</strong>Adicione uma receita ou despesa para começar.</div></td></tr>';
    return list.map(t=>{
      const cat=state.categories.find(c=>c.id===t.category_id);
      const kind=t.kind==="income"?"income":"expense";
      return '<tr><td><span class="desc-cell">'+escapeHtml(t.description)+'</span><span class="sub-cell">'+escapeHtml(cat?cat.name:(t.kind==="income"?"Receita":"Sem categoria"))+'</span></td><td>'+fmtDate(t.occurred_at)+'</td><td><span class="tag '+kind+'">'+(kind==="income"?"Receita":"Despesa")+'</span></td><td class="amount '+(kind==="income"?"positive":"negative")+'">'+(kind==="income"?"+":"−")+fmtMoney(t.amount)+'</td><td><button class="text-button" data-delete-transaction="'+t.id+'" type="button">Excluir</button></td></tr>';
    }).join("");
  }
  function billsMarkup(list,limit) {
    const items=(limit?list.slice(0,limit):list);
    if(!items.length) return '<div class="empty-state"><strong>Nenhuma conta cadastrada.</strong>Inclua vencimentos para acompanhar o mês.</div>';
    return '<div class="bill-list">'+items.map(b=>'<div class="bill-row"><div class="bill-info"><strong>'+escapeHtml(b.description)+'</strong><span>Vencimento: '+fmtDate(b.due_date)+'</span></div><div class="bill-amount">'+fmtMoney(b.amount)+'<small>'+(b.status==="paid"?"Paga":"Pendente")+'</small></div>'+(b.status==="pending"?'<button class="btn btn-quiet btn-small" data-pay-bill="'+b.id+'" type="button">Pagar</button>':'')+'</div>').join("")+'</div>';
  }
  function heading(title,subtitle,button) {
    return '<div class="page-heading"><div><h2>'+title+'</h2><p>'+subtitle+'</p></div>'+(button||"")+'</div>';
  }
  function homeView() {
    const s=balanceStats(), recent=state.transactions.slice(0,7);
    const pending=state.bills.filter(b=>b.status==="pending").sort((a,b)=>a.due_date.localeCompare(b.due_date));
    return '<div class="welcome-row"><div><h2>Olá! Veja como está a vida financeira da família.</h2><p>Resumo atualizado dos lançamentos registrados no Financeiro Familiar.</p></div><div class="actions-row"><button class="btn btn-secondary" data-action="new-bill">＋ Conta a pagar</button><button class="btn btn-primary" data-action="new-transaction">＋ Lançamento</button></div></div>'+
      '<div class="stats-grid">'+
      statCard("Saldo calculado",fmtMoney(s.balance),"◈","Saldo inicial + receitas − despesas")+
      statCard("Receitas do mês",fmtMoney(s.monthIn),"↗","Entradas registradas neste mês","positive")+
      statCard("Despesas do mês",fmtMoney(s.monthOut),"↘","Saídas registradas neste mês","negative")+
      statCard("Contas pendentes",fmtMoney(s.pending),"▤",pending.length+" conta(s) aguardando pagamento")+
      '</div><div class="content-grid"><section class="panel"><div class="panel-head"><div><h3>Movimentações recentes</h3><p>Últimos lançamentos registrados</p></div><button class="link-button" data-goto="transactions">Ver todas</button></div><div class="table-wrap"><table><thead><tr><th>DESCRIÇÃO</th><th>DATA</th><th>TIPO</th><th>VALOR</th><th></th></tr></thead><tbody>'+transactionRows(recent)+'</tbody></table></div></section><section class="panel"><div class="panel-head"><div><h3>Próximas contas</h3><p>Contas que ainda precisam ser pagas</p></div><button class="link-button" data-goto="bills">Ver todas</button></div>'+billsMarkup(pending,5)+'</section></div>';
  }
  function transactionsView() {
    return heading("Lançamentos","Receitas e despesas registradas pela família.",'<button class="btn btn-primary" data-action="new-transaction">＋ Novo lançamento</button>')+
      '<section class="panel"><div class="table-wrap"><table><thead><tr><th>DESCRIÇÃO</th><th>DATA</th><th>TIPO</th><th>VALOR</th><th>AÇÃO</th></tr></thead><tbody>'+transactionRows(state.transactions)+'</tbody></table></div></section>';
  }
  function billsView() {
    const sorted=state.bills.slice().sort((a,b)=>a.due_date.localeCompare(b.due_date));
    return heading("Contas a pagar","Acompanhe vencimentos e marque pagamentos realizados.",'<button class="btn btn-primary" data-action="new-bill">＋ Nova conta</button>')+
      '<section class="panel">'+billsMarkup(sorted)+'</section>';
  }
  function planningView() {
    const expenses=monthTransactions().filter(t=>t.kind==="expense");
    const grouped={}; expenses.forEach(t=>{const c=state.categories.find(x=>x.id===t.category_id);const name=c?c.name:"Sem categoria";grouped[name]=(grouped[name]||0)+Number(t.amount);});
    const rows=Object.entries(grouped).sort((a,b)=>b[1]-a[1]);
    return heading("Planejamento","Visualize onde estão concentradas as despesas deste mês.")+
      '<section class="panel"><div class="panel-head"><div><h3>Despesas por categoria</h3><p>Baseado nos lançamentos registrados neste mês</p></div></div>'+
      (rows.length?rows.map(([name,val])=>'<div class="bill-row"><div class="bill-info"><strong>'+escapeHtml(name)+'</strong><span>'+((val/(balanceStats().monthOut||1))*100).toFixed(1)+'% das despesas</span></div><div class="bill-amount">'+fmtMoney(val)+'</div></div>').join(""):'<div class="empty-state"><strong>Ainda não há despesas neste mês.</strong>Registre suas movimentações para montar o planejamento.</div>')+
      '<p class="tiny muted">O cadastro de limites mensais por categoria será habilitado na próxima etapa.</p></section>';
  }
  function reportsView() {
    const s=balanceStats(), current=monthTransactions();
    const net=s.monthIn-s.monthOut;
    return heading("Relatórios","Resumo dos valores registrados no mês atual.")+
      '<div class="stats-grid">'+statCard("Receitas",fmtMoney(s.monthIn),"↗","Total de entradas no mês","positive")+statCard("Despesas",fmtMoney(s.monthOut),"↘","Total de saídas no mês","negative")+statCard("Resultado",fmtMoney(net),"＝","Receitas menos despesas",net>=0?"positive":"negative")+statCard("Movimentações",String(current.length),"▦","Quantidade de registros do mês")+'</div>'+
      '<section class="panel"><div class="panel-head"><div><h3>Resumo do período</h3><p>'+new Date().toLocaleDateString("pt-BR",{month:"long",year:"numeric"})+'</p></div><button class="btn btn-quiet btn-small" data-action="export-csv">Exportar CSV</button></div>'+
      '<div class="bill-row"><div class="bill-info"><strong>Saldo inicial das contas</strong></div><div class="bill-amount">'+fmtMoney(state.accounts.reduce((s,a)=>s+Number(a.opening_balance||0),0))+'</div></div>'+
      '<div class="bill-row"><div class="bill-info"><strong>Receitas no mês</strong></div><div class="bill-amount positive">'+fmtMoney(s.monthIn)+'</div></div>'+
      '<div class="bill-row"><div class="bill-info"><strong>Despesas no mês</strong></div><div class="bill-amount negative">'+fmtMoney(s.monthOut)+'</div></div>'+
      '<div class="bill-row"><div class="bill-info"><strong>Resultado do mês</strong></div><div class="bill-amount">'+fmtMoney(net)+'</div></div></section>';
  }
  function settingsView() {
    const isOwner=state.membership && state.membership.role==="owner";
    return heading("Configurações","Dados da conta e compartilhamento familiar.")+
      '<div class="settings-grid"><section class="setting-card"><h3>Espaço familiar</h3><p><strong>'+escapeHtml(state.household.name)+'</strong><br>Moeda: Real brasileiro (BRL)<br>Seu perfil: '+(isOwner?"Responsável":"Membro")+'</p></section>'+
      '<section class="setting-card"><h3>Conta conectada</h3><p>'+escapeHtml(state.user.email)+'<br>Dados sincronizados pelo Supabase. A conexão bancária automática com a Caixa ainda não está ativa.</p><p>Saldo inicial cadastrado: <strong>'+fmtMoney(state.accounts.reduce((sum,a)=>sum+Number(a.opening_balance||0),0))+'</strong></p><button class="btn btn-quiet btn-small" data-action="edit-opening-balance">Ajustar saldo inicial</button></section>'+
      '<section class="setting-card"><h3>Compartilhar com a segunda pessoa</h3><p>Gere um código de uso único com validade de 7 dias. A outra pessoa deve criar sua própria conta e informar esse código.</p>'+(isOwner?'<button class="btn btn-primary" data-action="create-invite">Gerar código de convite</button><div id="inviteResult"></div>':'<p>Peça o código ao responsável pelo espaço familiar.</p>')+'</section>'+
      '<section class="setting-card"><h3>Segurança e privacidade</h3><p>Não compartilhe sua senha. O código de convite dá acesso ao espaço familiar e deve ser enviado somente à pessoa autorizada. Nunca informe senha bancária ou código de autenticação da Caixa.</p><button class="btn btn-quiet btn-small" data-action="refresh">Sincronizar agora</button></section>'+
      '</div>';
  }
  function render() {
    const views={home:homeView,transactions:transactionsView,bills:billsView,planning:planningView,reports:reportsView,settings:settingsView};
    const titles={home:"Início",transactions:"Lançamentos",bills:"Contas a pagar",planning:"Planejamento",reports:"Relatórios",settings:"Configurações"};
    $("pageTitle").textContent=titles[state.view]||"Início";
    $("topEyebrow").textContent=state.view==="home"?"VISÃO GERAL":"FINANCEIRO FAMILIAR";
    document.querySelectorAll(".nav-item[data-view]").forEach(b=>b.classList.toggle("active",b.dataset.view===state.view));
    $("pageContent").innerHTML=(views[state.view]||homeView)();
  }
  function openModal(title,html) {
    $("modalTitle").textContent=title; $("modalBody").innerHTML=html; $("modalBackdrop").hidden=false;
  }
  function closeModal(){ $("modalBackdrop").hidden=true; $("modalBody").innerHTML=""; }
  function categoryOptions(kind) {
    return state.categories.filter(c=>c.kind===kind).map(c=>'<option value="'+c.id+'">'+escapeHtml(c.name)+'</option>').join("");
  }
  function transactionForm() {
    openModal("Novo lançamento",'<form id="transactionForm"><div class="form-grid">'+
      '<div class="field"><label for="txKind">Tipo</label><select id="txKind" name="kind"><option value="expense">Despesa</option><option value="income">Receita</option></select></div>'+
      '<div class="field"><label for="txAmount">Valor (R$)</label><input id="txAmount" name="amount" inputmode="decimal" placeholder="0,00" required></div>'+
      '<div class="field full"><label for="txDescription">Descrição</label><input id="txDescription" name="description" maxlength="120" placeholder="Ex.: Compra no supermercado" required></div>'+
      '<div class="field"><label for="txCategory">Categoria</label><select id="txCategory" name="category_id"><option value="">Sem categoria</option>'+categoryOptions("expense")+'</select></div>'+
      '<div class="field"><label for="txAccount">Conta</label><select id="txAccount" name="account_id">'+state.accounts.map(a=>'<option value="'+a.id+'">'+escapeHtml(a.name)+'</option>').join("")+'</select></div>'+
      '<div class="field"><label for="txDate">Data</label><input id="txDate" name="occurred_at" type="date" value="'+dateToday()+'" required></div>'+
      '<div class="field"><label for="txPayment">Forma de pagamento</label><select id="txPayment" name="payment_method"><option value="pix">Pix</option><option value="debit">Débito</option><option value="cash">Dinheiro</option><option value="bank_transfer">Transferência</option><option value="boleto">Boleto</option><option value="other">Outro</option></select></div>'+
      '<div class="field full"><label for="txNotes">Observação (opcional)</label><textarea id="txNotes" name="notes" rows="2"></textarea></div></div>'+
      '<div class="form-actions"><button class="btn btn-quiet" type="button" data-action="close-modal">Cancelar</button><button class="btn btn-primary" type="submit">Salvar lançamento</button></div></form>');
    $("txKind").addEventListener("change",e=>{$("txCategory").innerHTML='<option value="">Sem categoria</option>'+categoryOptions(e.target.value);});
    $("transactionForm").addEventListener("submit",saveTransaction);
  }
  function billForm() {
    openModal("Nova conta a pagar",'<form id="billForm"><div class="form-grid">'+
      '<div class="field full"><label for="billDescription">Descrição</label><input id="billDescription" maxlength="120" placeholder="Ex.: Conta de energia" required></div>'+
      '<div class="field"><label for="billAmount">Valor (R$)</label><input id="billAmount" inputmode="decimal" placeholder="0,00" required></div>'+
      '<div class="field"><label for="billDue">Vencimento</label><input id="billDue" type="date" value="'+dateToday()+'" required></div>'+
      '<div class="field"><label for="billCategory">Categoria</label><select id="billCategory"><option value="">Sem categoria</option>'+categoryOptions("expense")+'</select></div>'+
      '<div class="field"><label for="billRecurrence">Recorrência</label><select id="billRecurrence"><option value="none">Não recorrente</option><option value="monthly">Mensal</option><option value="yearly">Anual</option></select></div>'+
      '</div><div class="form-actions"><button class="btn btn-quiet" type="button" data-action="close-modal">Cancelar</button><button class="btn btn-primary" type="submit">Salvar conta</button></div></form>');
    $("billForm").addEventListener("submit",saveBill);
  }
  function parseAmount(raw) {
    const val=String(raw||"").trim().replace(/\s/g,"").replace(/\./g,"").replace(",",".");
    const n=Number(val); return Number.isFinite(n)&&n>0?n:null;
  }
  async function saveTransaction(e) {
    e.preventDefault(); const f=e.currentTarget;
    const amount=parseAmount(f.amount.value); if(!amount){toast("Informe um valor válido maior que zero.");return;}
    const payload={household_id:state.household.id,kind:f.kind.value,description:f.description.value.trim(),amount,occurred_at:f.occurred_at.value,category_id:f.category_id.value||null,account_id:f.account_id.value||null,payment_method:f.payment_method.value,notes:f.notes.value.trim()||null,source:"manual"};
    const btn=f.querySelector('button[type="submit"]');btn.disabled=true;btn.textContent="Salvando...";
    const {error}=await client.from("transactions").insert(payload);
    if(error){btn.disabled=false;btn.textContent="Salvar lançamento";toast("Erro ao salvar: "+error.message);return;}
    closeModal();toast("Lançamento salvo e sincronizado.");await refresh();
  }
  function openingBalanceForm() {
    const account=state.accounts[0];
    if(!account){toast("Nenhuma conta ativa foi encontrada.");return;}
    openModal("Saldo inicial da conta Caixa",'<form id="openingBalanceForm"><p class="muted" style="font-size:12px;line-height:1.5">Informe o saldo da conta na data em que você começar a usar o aplicativo. Os lançamentos posteriores serão somados ou descontados desse valor.</p><div class="field"><label for="openingBalance">Saldo inicial (R$)</label><input id="openingBalance" inputmode="decimal" value="'+String(account.opening_balance||0).replace(".",",")+'" required></div><div class="form-actions"><button class="btn btn-quiet" type="button" data-action="close-modal">Cancelar</button><button class="btn btn-primary" type="submit">Salvar saldo</button></div></form>');
    $("openingBalanceForm").addEventListener("submit",async e=>{
      e.preventDefault();
      const raw=$("openingBalance").value.trim().replace(/\s/g,"").replace(/\./g,"").replace(",",".");
      const amount=Number(raw);
      if(!Number.isFinite(amount)){toast("Informe um saldo válido.");return;}
      const btn=e.currentTarget.querySelector('button[type="submit"]');btn.disabled=true;btn.textContent="Salvando...";
      const {error}=await client.from("financial_accounts").update({opening_balance:amount}).eq("id",account.id).eq("household_id",state.household.id);
      if(error){btn.disabled=false;btn.textContent="Salvar saldo";toast("Erro ao atualizar: "+error.message);return;}
      closeModal();toast("Saldo inicial atualizado.");await refresh();
    });
  }
  async function saveBill(e) {
    e.preventDefault(); const amount=parseAmount($("billAmount").value);if(!amount){toast("Informe um valor válido maior que zero.");return;}
    const btn=e.currentTarget.querySelector('button[type="submit"]');btn.disabled=true;btn.textContent="Salvando...";
    const {error}=await client.from("bills").insert({household_id:state.household.id,description:$("billDescription").value.trim(),amount,due_date:$("billDue").value,category_id:$("billCategory").value||null,recurrence:$("billRecurrence").value,status:"pending"});
    if(error){btn.disabled=false;btn.textContent="Salvar conta";toast("Erro ao salvar: "+error.message);return;}
    closeModal();toast("Conta cadastrada.");await refresh();
  }
  async function markBillPaid(id) {
    const {error}=await client.from("bills").update({status:"paid",paid_at:dateToday()}).eq("id",id).eq("household_id",state.household.id);
    if(error){toast("Não foi possível atualizar: "+error.message);return;} toast("Conta marcada como paga.");await refresh();
  }
  async function deleteTransaction(id) {
    if(!window.confirm("Excluir este lançamento?"))return;
    const {error}=await client.from("transactions").delete().eq("id",id).eq("household_id",state.household.id);
    if(error){toast("Não foi possível excluir: "+error.message);return;}toast("Lançamento excluído.");await refresh();
  }
  async function createInvite() {
    const {data,error}=await client.rpc("create_household_invite");
    if(error){toast(error.message);return;}
    const target=$("inviteResult"); if(!target)return;
    target.innerHTML='<div class="code-box" id="inviteCodeText">'+escapeHtml(data)+'</div><button class="btn btn-secondary btn-small" id="copyInvite" type="button">Copiar código</button><p class="tiny muted">Código de uso único. Expira em 7 dias. Envie somente à pessoa que fará parte da família.</p>';
    $("copyInvite").addEventListener("click",async()=>{try{await navigator.clipboard.writeText(String(data));toast("Código copiado.");}catch(e){toast("Selecione e copie o código manualmente.");}});
  }
  async function exportCsv() {
    const rows=[["Data","Tipo","Descrição","Categoria","Valor","Forma de pagamento"]];
    state.transactions.forEach(t=>{const c=state.categories.find(x=>x.id===t.category_id);rows.push([t.occurred_at,t.kind,t.description,c?c.name:"",String(t.amount),t.payment_method||""]);});
    const csv="\uFEFF"+rows.map(r=>r.map(v=>'"'+String(v??"").replace(/"/g,'""')+'"').join(";")).join("\n");
    const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));const a=document.createElement("a");a.href=url;a.download="financeiro-familiar-lancamentos.csv";a.click();URL.revokeObjectURL(url);
  }
  async function createHousehold(e) {
    e.preventDefault();const name=$("householdName").value.trim();const btn=e.currentTarget.querySelector('button[type="submit"]');btn.disabled=true;btn.textContent="Criando...";
    const {error}=await client.rpc("create_household",{p_name:name});
    if(error){btn.disabled=false;btn.textContent="Criar espaço familiar";setNotice("setupMessage",error.message,"error");return;}
    toast("Espaço familiar criado.");await loadWorkspace();
  }
  async function joinHousehold(e) {
    e.preventDefault();const code=$("inviteCode").value.trim();const btn=e.currentTarget.querySelector('button[type="submit"]');btn.disabled=true;btn.textContent="Validando...";
    const {error}=await client.rpc("join_household_with_code",{p_code:code});
    if(error){btn.disabled=false;btn.textContent="Entrar com código";setNotice("setupMessage",error.message,"error");return;}
    toast("Você entrou no espaço familiar.");await loadWorkspace();
  }
  async function submitAuth(e) {
    e.preventDefault();const email=$("authEmail").value.trim();const password=$("authPassword").value;const btn=$("authSubmit");btn.disabled=true;btn.textContent=state.signup?"Criando conta...":"Entrando...";
    try{
      if(state.signup){
        const {data,error}=await client.auth.signUp({email,password,options:{emailRedirectTo:window.location.href.split("?")[0]}});
        if(error)throw error;
        if(data.session){state.user=data.user;await loadWorkspace();}
        else setNotice("authMessage","Cadastro recebido. Confira seu e-mail para confirmar a conta e depois entre no aplicativo.","success");
      }else{
        const {error}=await client.auth.signInWithPassword({email,password});if(error)throw error;
      }
    }catch(err){setNotice("authMessage",err.message,"error");}
    finally{btn.disabled=false;btn.textContent=state.signup?"Criar conta":"Entrar";}
  }
  async function forgotPassword() {
    const email=$("authEmail").value.trim();if(!email){setNotice("authMessage","Informe seu e-mail primeiro.");return;}
    const {error}=await client.auth.resetPasswordForEmail(email,{redirectTo:window.location.href.split("?")[0]});
    setNotice("authMessage",error?error.message:"Enviamos as instruções para seu e-mail, caso ele esteja cadastrado.",error?"error":"success");
  }
  async function signOut(){await client.auth.signOut();state.user=null;state.household=null;state.membership=null;showAuth();}
  document.addEventListener("click",async e=>{
    const nav=e.target.closest("[data-view]");if(nav){state.view=nav.dataset.view;render();$("sidebar").classList.remove("open");return;}
    const goto=e.target.closest("[data-goto]");if(goto){state.view=goto.dataset.goto;render();return;}
    const action=e.target.closest("[data-action]");if(action){const a=action.dataset.action;if(a==="new-transaction")transactionForm();if(a==="new-bill")billForm();if(a==="close-modal")closeModal();if(a==="create-invite")createInvite();if(a==="edit-opening-balance")openingBalanceForm();if(a==="refresh")refresh();if(a==="export-csv")exportCsv();}
    const pay=e.target.closest("[data-pay-bill]");if(pay)markBillPaid(pay.dataset.payBill);
    const del=e.target.closest("[data-delete-transaction]");if(del)deleteTransaction(del.dataset.deleteTransaction);
  });
  $("authForm").addEventListener("submit",submitAuth);
  $("toggleSignup").addEventListener("click",()=>{state.signup=!state.signup;$("authSubmit").textContent=state.signup?"Criar conta":"Entrar";$("toggleSignup").textContent=state.signup?"Já tenho uma conta":"Criar uma conta";$("authPassword").autocomplete=state.signup?"new-password":"current-password";setNotice("authMessage",state.signup?"Use um e-mail válido e uma senha com pelo menos 8 caracteres.":"");});
  $("forgotPassword").addEventListener("click",forgotPassword);
  $("createHouseholdForm").addEventListener("submit",createHousehold);
  $("joinHouseholdForm").addEventListener("submit",joinHousehold);
  $("setupSignout").addEventListener("click",signOut);$("signoutButton").addEventListener("click",signOut);
  $("closeModal").addEventListener("click",closeModal);$("modalBackdrop").addEventListener("click",e=>{if(e.target===$("modalBackdrop"))closeModal();});
  $("mobileMenu").addEventListener("click",()=>$("sidebar").classList.toggle("open"));
  client.auth.onAuthStateChange(async(_event,session)=>{
    if(session){state.user=session.user;try{await loadWorkspace();}catch(err){showAuth();setNotice("authMessage","Erro ao carregar seus dados: "+err.message,"error");}}
    else{state.user=null;showAuth();}
  });
  client.auth.getSession().then(async({data,error})=>{
    if(error){setNotice("authMessage",error.message,"error");return;}
    if(data.session){state.user=data.session.user;try{await loadWorkspace();}catch(err){showAuth();setNotice("authMessage","Erro ao carregar seus dados: "+err.message,"error");}}
    else showAuth();
  });
  if("serviceWorker" in navigator){window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));}
})();