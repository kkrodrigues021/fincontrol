// Sistema de Banco de Dados Local
const db = {
  salvar: (chave, dados) => {
    console.log(`Salvando ${chave}:`, dados);
    localStorage.setItem(chave, JSON.stringify(dados));
  },
  carregar: (chave) => {
    const dados = JSON.parse(localStorage.getItem(chave)) || [];
    console.log(`Carregando ${chave}:`, dados);
    return dados;
  }
};

// Variáveis Globais
let transactions = db.carregar('transactions');
let bankBalance = parseFloat(localStorage.getItem('bankBalance')) || 0;
let customCategories = db.carregar('customCategories');
let financeChart;

// Sistema de Notificações
function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;
  
  const notifications = document.getElementById('notifications');
  notifications.appendChild(notification);
  
  setTimeout(() => {
    notification.remove();
  }, 3000);
}

// Inicialização
function init() {
  bankBalance = parseFloat(bankBalance) || 0;
  localStorage.setItem('bankBalance', bankBalance);
  
  initTheme();
  updateCategoryDropdown();
  renderTransactions();
  renderCreditCardBills();
  updateSummary();
  updateChart();
  updateBankBalance();
}

// Tema Dark/Light
function initTheme() {
  const savedTheme = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  document.getElementById('theme-toggle').textContent = savedTheme === 'light' ? '🌙 Dark Mode' : '☀️ Light Mode';
}

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const newTheme = currentTheme === 'light' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', newTheme);
  document.getElementById('theme-toggle').textContent = newTheme === 'light' ? '🌙 Dark Mode' : '☀️ Light Mode';
  localStorage.setItem('theme', newTheme);
}

// Categorias
function updateCategoryDropdown() {
  const defaultCategories = [
    { value: 'salario', label: 'Salário' },
    { value: 'cartao', label: 'Cartão de Crédito' },
    { value: 'pix', label: 'PIX' }
  ];  

  const categorySelect = document.getElementById('category');
  categorySelect.innerHTML = '';

  defaultCategories.forEach(cat => {
    const option = document.createElement('option');
    option.value = cat.value;
    option.textContent = cat.label;
    categorySelect.appendChild(option);
  });

  customCategories.forEach(cat => {
    const option = document.createElement('option');
    option.value = cat.toLowerCase().replace(/\s+/g, '-');
    option.textContent = cat;
    categorySelect.appendChild(option);
  });
}

function addCustomCategory() {
  const newCategoryInput = document.getElementById('new-category');
  const newCategory = newCategoryInput.value.trim();

  if (!newCategory) return;

  if (!customCategories.includes(newCategory)) {
    customCategories.push(newCategory);
    db.salvar('customCategories', customCategories);
    updateCategoryDropdown();
    newCategoryInput.value = '';
    showNotification(`Categoria "${newCategory}" adicionada!`, 'success');
  } else {
    showNotification(`Categoria "${newCategory}" já existe!`, 'error');
  }
}

// Transações
function renderTransactions() {
  const tbody = document.getElementById('transactions-list');
  tbody.innerHTML = '';

  transactions
    .filter(t => t.category !== 'cartao' || t.paid)
    .forEach(transaction => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${transaction.description}</td>
      <td class="${(transaction.category === 'cartao' && transaction.paid) ? 'expense' : transaction.type}">
        R$ ${transaction.amount.toFixed(2)}
      </td>
      <td>${transaction.category}</td>
      <td>${new Date(transaction.date).toLocaleDateString()}</td>
      <td>
        <button onclick="deleteTransaction(${transaction.id})">Excluir</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function addTransaction(e) {
  e.preventDefault();

  const description = document.getElementById('description').value.trim();
  const amount = parseFloat(document.getElementById('amount').value);
  const type = document.getElementById('type').value;
  const category = document.getElementById('category').value;

  if (!description || isNaN(amount) || amount <= 0) {
    showNotification('Preencha todos os campos corretamente! Valor deve ser maior que zero.', 'error');
    return;
  }

  if ((category === 'salario' || category === 'cartao') && type === 'expense') {
    showNotification(`A categoria "${category === 'salario' ? 'Salário' : 'Cartão'}" só pode ser usada como entrada!`, 'error');
    return;
  }

  const transaction = {
    id: Date.now(),
    description,
    amount,
    type,
    category,
    date: new Date().toISOString(),
    paid: false
  };

  transactions.push(transaction);
  
  if (category === 'cartao') {
    showNotification(`Compra no cartão de R$ ${amount.toFixed(2)} adicionada à fatura.`, 'info');
  } else if (type === 'income') {
    bankBalance += amount;
    showNotification(`Entrada de R$ ${amount.toFixed(2)} registrada! Saldo: R$ ${bankBalance.toFixed(2)}`, 'success');
  } else {
    bankBalance -= amount;
    showNotification(`Saída de R$ ${amount.toFixed(2)} registrada! Saldo: R$ ${bankBalance.toFixed(2)}`, 'info');
  }

  saveAllData();
  e.target.reset();
}

function deleteTransaction(id) {
  const transaction = transactions.find(t => t.id === id);
  if (!transaction) return;

  if (confirm(`Excluir transação "${transaction.description}"?`)) {
    // Reverte o saldo se for uma transação que afetou o banco
    if (transaction.category === 'cartao') {
      if (transaction.paid) {
        bankBalance += transaction.amount; // Fatura paga será desfeita
      }
    } else {
      if (transaction.type === 'income') {
        bankBalance -= transaction.amount;
      } else {
        bankBalance += transaction.amount;
      }
    }
    
    transactions = transactions.filter(t => t.id !== id);
    saveAllData();
    showNotification('Transação removida!', 'info');
  }
}

// Faturas do Cartão
function renderCreditCardBills() {
  const container = document.getElementById('credit-card-bills');
  container.innerHTML = '';
  
  const unpaidBills = transactions.filter(
    t => t.category === 'cartao' && !t.paid
  );

  if (unpaidBills.length === 0) {
    container.innerHTML = '<p class="no-bills">Nenhuma fatura pendente</p>';
    return;
  }

  unpaidBills.forEach(transaction => {
    const billElement = document.createElement('div');
    billElement.className = 'bill-item';
    billElement.innerHTML = `
      <div class="bill-info">
        <strong>${transaction.description}</strong>
        <span class="expense">R$ ${transaction.amount.toFixed(2)}</span>
        <small>${new Date(transaction.date).toLocaleDateString()}</small>
      </div>
      <div class="bill-actions">
        <button class="pay-button small" onclick="payBill(${transaction.id})">Pagar</button>
        <button class="delete-button small" onclick="deleteTransaction(${transaction.id})">Excluir</button>
      </div>
    `;
    container.appendChild(billElement);
  });
}

function payBill(transactionId) {
  const transaction = transactions.find(t => t.id === transactionId);
  if (!transaction) return;

  if (bankBalance < transaction.amount) {
    showNotification(`Saldo insuficiente! Você tem R$ ${bankBalance.toFixed(2)} e precisa de R$ ${transaction.amount.toFixed(2)}`, 'error');
    return;
  }

  if (confirm(`Pagar ${transaction.description} de R$ ${transaction.amount.toFixed(2)}?`)) {
    bankBalance -= transaction.amount;
    transaction.paid = true;
    saveAllData();
    showNotification(`Fatura paga! Saldo atual: R$ ${bankBalance.toFixed(2)}`, 'success');
  }
}

// Saldo Bancário
function updateBankBalance() {
  bankBalance = parseFloat(bankBalance);
  
  const bankTotalElement = document.getElementById('bank-total');
  bankTotalElement.textContent = `R$ ${bankBalance.toFixed(2)}`;
  
  if (bankBalance < 0) {
    bankTotalElement.classList.add('negative-balance');
  } else {
    bankTotalElement.classList.remove('negative-balance');
  }
  
  localStorage.setItem('bankBalance', bankBalance);
}

// Resumo
function updateSummary() {
  const income = transactions
    .filter(t =>
      t.type === 'income' &&
      t.category !== 'cartao'
    )
    .reduce((sum, t) => sum + t.amount, 0);

  const expense = transactions
    .filter(t =>
      (t.type === 'expense' && t.category !== 'cartao') ||
      (t.category === 'cartao' && t.paid) // faturas pagas são saídas reais
    )
    .reduce((sum, t) => sum + t.amount, 0);

  document.getElementById('income-total').textContent = `R$ ${income.toFixed(2)}`;
  document.getElementById('expense-total').textContent = `R$ ${expense.toFixed(2)}`;
  document.getElementById('balance-total').textContent = `R$ ${(income - expense).toFixed(2)}`;
}

// Gráfico
function updateChart() {
  const ctx = document.getElementById('finance-chart').getContext('2d');
  const categories = {};

  transactions.forEach(t => {
    // Ignora transações de cartão não pagas
    if (t.category === 'cartao' && !t.paid) return;
  
    const label = (t.category === 'cartao' && t.paid)
      ? `Pagamento de fatura: ${t.description}`
      : t.category;
  
    if (!categories[label]) {
      categories[label] = 0;
    }
    categories[label] += t.amount;
  });

  if (financeChart) {
    financeChart.destroy();
  }

  financeChart = new Chart(ctx, {
    type: 'pie',
    data: {
      labels: Object.keys(categories),
      datasets: [{
        data: Object.values(categories),
        backgroundColor: [
          '#2ecc71', '#3498db', '#f1c40f', '#e74c3c', '#9b59b6', '#1abc9c'
        ],
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: getComputedStyle(document.documentElement).getPropertyValue('--text')
          }
        }
      }
    }
  });
}

// Função para salvar todos os dados
function saveAllData() {
  db.salvar('transactions', transactions);
  db.salvar('bankBalance', bankBalance);
  db.salvar('customCategories', customCategories);

  renderTransactions();
  renderCreditCardBills();
  updateSummary();
  updateChart();
  updateBankBalance();
}

// Event Listeners
document.addEventListener('DOMContentLoaded', function() {
  document.getElementById('transaction-form').addEventListener('submit', addTransaction);
  document.getElementById('theme-toggle').addEventListener('click', toggleTheme);
  document.getElementById('add-category').addEventListener('click', addCustomCategory);
  
  init();
});