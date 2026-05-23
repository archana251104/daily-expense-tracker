class BaseEntity {
            constructor(id, createdAt = null) {
                this.id = id;
                this.createdAt = createdAt || new Date();
            }

            toJSON() {
                return {
                    id: this.id,
                    createdAt: this.createdAt.toISOString()
                }
            }
        }

        // Expense Class (Inheritance + Encapsulation)
        class Expense extends BaseEntity {
            #amount;  // Private field (Encapsulation)
            
            constructor(id, amount, category, description, date = null) {
                super(id);
                this.#amount = amount;
                this.category = category;
                this.description = description;
                this.date = date || new Date();
            }

            // Getter for amount (Encapsulation)
            get amount() {
                return this.#amount;
            }

            // Setter with validation (Encapsulation)
            set amount(value) {
                if (value <= 0) {
                    throw new Error("Amount must be positive");
                }
                this.#amount = value;
            }

            toJSON() {
                return {
                    ...super.toJSON(),
                    amount: this.#amount,
                    category: this.category,
                    description: this.description,
                    date: this.date.toISOString()
                };
            }

            static fromJSON(json) {
                return new Expense(
                    json.id,
                    json.amount,
                    json.category,
                    json.description,
                    new Date(json.date)
                );
            }
        }

        // Category Class
        class Category {
            constructor(name, budgetLimit = null) {
                this.name = name;
                this.budgetLimit = budgetLimit;
                this.expenses = [];
            }

            getTotalSpent() {
                return this.expenses.reduce((sum, expense) => sum + expense.amount, 0);
            }

            isOverBudget() {
                if (this.budgetLimit) {
                    return this.getTotalSpent() > this.budgetLimit;
                }
                return false;
            }

            addExpense(expense) {
                this.expenses.push(expense);
            }

            removeExpense(expenseId) {
                this.expenses = this.expenses.filter(e => e.id !== expenseId);
            }
        }

        // Main ExpenseTracker Class
        class ExpenseTracker {
            constructor() {
                this.expenses = [];
                this.categories = new Map();
                this.nextId = 1;
                this.loadFromLocalStorage();
            }

            // Add new expense
            addExpense(amount, categoryName, description, date = null) {
                try {
                    const expense = new Expense(this.nextId++, amount, categoryName, description, date);
                    this.expenses.push(expense);
                    
                    // Update category tracking
                    if (!this.categories.has(categoryName)) {
                        this.categories.set(categoryName, new Category(categoryName));
                    }
                    this.categories.get(categoryName).addExpense(expense);
                    
                    this.saveToLocalStorage();
                    return { success: true, expense };
                } catch (error) {
                    return { success: false, error: error.message };
                }
            }

            // Delete expense
            deleteExpense(expenseId) {
                const expense = this.expenses.find(e => e.id === expenseId);
                if (expense) {
                    // Remove from category
                    const category = this.categories.get(expense.category);
                    if (category) {
                        category.removeExpense(expenseId);
                    }
                    
                    // Remove from main array
                    this.expenses = this.expenses.filter(e => e.id !== expenseId);
                    this.saveToLocalStorage();
                    return true;
                }
                return false;
            }

            // Get total expenses
            getTotalExpenses() {
                return this.expenses.reduce((sum, expense) => sum + expense.amount, 0);
            }

            // Get expenses by category
            getExpensesByCategory(categoryName) {
                return this.expenses.filter(e => e.category === categoryName);
            }

            // Get monthly summary
            getMonthlySummary(year, month) {
                const monthlyExpenses = this.expenses.filter(expense => {
                    return expense.date.getFullYear() === year && 
                           expense.date.getMonth() === month;
                });
                
                const summary = {};
                monthlyExpenses.forEach(expense => {
                    if (!summary[expense.category]) {
                        summary[expense.category] = 0;
                    }
                    summary[expense.category] += expense.amount;
                });
                
                return {
                    year,
                    month,
                    summary,
                    total: monthlyExpenses.reduce((sum, e) => sum + e.amount, 0)
                };
            }

            // Get category breakdown
            getCategoryBreakdown() {
                const breakdown = [];
                for (let [name, category] of this.categories) {
                    breakdown.push({
                        name: name,
                        total: category.getTotalSpent(),
                        budgetLimit: category.budgetLimit,
                        isOverBudget: category.isOverBudget(),
                        transactionCount: category.expenses.length
                    });
                }
                return breakdown.sort((a, b) => b.total - a.total);
            }

            // Set budget for category
            setCategoryBudget(categoryName, budgetLimit) {
                if (!this.categories.has(categoryName)) {
                    this.categories.set(categoryName, new Category(categoryName));
                }
                this.categories.get(categoryName).budgetLimit = budgetLimit;
                this.saveToLocalStorage();
            }

            // Export to CSV
            exportToCSV() {
                if (this.expenses.length === 0) {
                    alert("No expenses to export!");
                    return;
                }
                
                const headers = ["ID", "Amount", "Category", "Description", "Date"];
                const rows = this.expenses.map(e => [
                    e.id,
                    e.amount,
                    e.category,
                    e.description,
                    e.date.toLocaleDateString()
                ]);
                
                const csvContent = [headers, ...rows]
                    .map(row => row.join(","))
                    .join("\n");
                
                const blob = new Blob([csvContent], { type: "text/csv" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `expenses_${new Date().toISOString().split('T')[0]}.csv`;
                a.click();
                URL.revokeObjectURL(url);
                
                this.showAlert("Exported successfully!", "success");
            }

            // Clear all data
            clearAllData() {
                if (confirm("⚠️ Are you sure you want to delete ALL expenses? This cannot be undone!")) {
                    this.expenses = [];
                    this.categories.clear();
                    this.nextId = 1;
                    this.saveToLocalStorage();
                    this.showAlert("All data cleared!", "success");
                    this.refreshUI();
                }
            }

            // Local Storage Methods
            saveToLocalStorage() {
                const data = {
                    expenses: this.expenses.map(e => e.toJSON()),
                    nextId: this.nextId,
                    categories: Array.from(this.categories.entries()).map(([name, cat]) => ({
                        name: name,
                        budgetLimit: cat.budgetLimit
                    }))
                };
                localStorage.setItem("expenseTrackerData", JSON.stringify(data));
            }

            loadFromLocalStorage() {
                const savedData = localStorage.getItem("expenseTrackerData");
                if (savedData) {
                    const data = JSON.parse(savedData);
                    this.expenses = data.expenses.map(e => Expense.fromJSON(e));
                    this.nextId = data.nextId;
                    
                    // Rebuild categories
                    this.categories.clear();
                    this.expenses.forEach(expense => {
                        if (!this.categories.has(expense.category)) {
                            const savedCat = data.categories.find(c => c.name === expense.category);
                            const category = new Category(expense.category, savedCat?.budgetLimit);
                            this.categories.set(expense.category, category);
                        }
                        this.categories.get(expense.category).addExpense(expense);
                    });
                } else {
                    // Add sample data for demo
                    this.addSampleData();
                }
            }

            addSampleData() {
                const sampleExpenses = [
                    [50.00, "Food", "Groceries", new Date(2026, 3, 15)],
                    [25.00, "Transport", "Uber ride", new Date(2026, 3, 16)],
                    [100.00, "Shopping", "New shoes", new Date(2026, 3, 17)],
                    [15.00, "Entertainment", "Netflix", new Date(2026, 3, 10)],
                    [200.00, "Bills", "Electricity bill", new Date(2026, 3, 5)]
                ];
                
                sampleExpenses.forEach(([amount, category, desc, date]) => {
                    this.addExpense(amount, category, desc, date);
                });
                
                // Set some budgets
                this.setCategoryBudget("Food", 300);
                this.setCategoryBudget("Bills", 500);
            }

            // UI Methods
            refreshUI() {
                updateStatistics(this);
                displayExpenses(this.expenses);
                displayCategoryBreakdown(this.getCategoryBreakdown());
            }

            showAlert(message, type) {
                const alertDiv = document.getElementById('alert');
                alertDiv.textContent = message;
                alertDiv.className = `alert ${type}`;
                
                setTimeout(() => {
                    alertDiv.style.display = 'none';
                    alertDiv.className = 'alert';
                }, 3000);
            }
        }

        // ============================================
        // UI HELPER FUNCTIONS
        // ============================================

        const expenseTracker = new ExpenseTracker();

        function updateStatistics(tracker) {
            document.getElementById('totalExpenses').innerHTML = `₹${tracker.getTotalExpenses().toFixed(2)}`;
            document.getElementById('categoryCount').innerHTML = tracker.categories.size;
            document.getElementById('transactionCount').innerHTML = tracker.expenses.length;
        }

        function displayExpenses(expenses) {
            const expensesList = document.getElementById('expensesList');
            
            if (!expenses || expenses.length === 0) {
                expensesList.innerHTML = '<div class="no-expenses">No expenses yet. Add your first expense!</div>';
                return;
            }
            
            expenses.sort((a, b) => b.date - a.date);
            
            expensesList.innerHTML = expenses.map(expense => `
                <div class="expense-item">
                    <div class="expense-info">
                        <div class="expense-category">${getCategoryIcon(expense.category)} ${expense.category}</div>
                        <div class="expense-description">${escapeHtml(expense.description) || 'No description'}</div>
                        <div class="expense-date">📅 ${formatDate(expense.date)}</div>
                    </div>
                    <div class="expense-amount">₹${expense.amount.toFixed(2)}</div>
                    <button class="delete-btn" onclick="deleteExpenseHandler(${expense.id})">Delete</button>
                </div>
            `).join('');
        }

        function displayCategoryBreakdown(breakdown) {
            const container = document.getElementById('categoryBreakdown');
            if (!container) return;
            
            if (breakdown.length === 0) {
                container.innerHTML = '<p style="color: #999; text-align: center; margin-top: 15px;">No categories yet</p>';
                return;
            }
            
            container.innerHTML = `
                <h3 style="margin: 20px 0 10px 0; font-size: 16px;">Spending by Category</h3>
                ${breakdown.map(cat => `
                    <div style="margin-bottom: 12px;">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                            <span>${getCategoryIcon(cat.name)} ${cat.name}</span>
                            <span style="font-weight: bold; ${cat.isOverBudget ? 'color: #ff4757;' : ''}">
                                ₹${cat.total.toFixed(2)}
                                ${cat.budgetLimit ? `/ ₹${cat.budgetLimit}` : ''}
                                ${cat.isOverBudget ? ' ⚠️ Over budget!' : ''}
                            </span>
                        </div>
                        ${cat.budgetLimit ? `
                            <div style="background: #e0e0e0; border-radius: 10px; overflow: hidden;">
                                <div style="background: ${cat.isOverBudget ? '#ff4757' : '#667eea'}; 
                                             width: ${Math.min((cat.total / cat.budgetLimit) * 100, 100)}%; 
                                             height: 8px;"></div>
                            </div>
                        ` : ''}
                    </div>
                `).join('')}
            `;
        }

        function getCategoryIcon(category) {
            const icons = {
                'Food': '🍔',
                'Transport': '🚗',
                'Shopping': '🛍️',
                'Entertainment': '🎬',
                'Bills': '💡',
                'Healthcare': '🏥',
                'Other': '📌'
            };
            return icons[category] || '💰';
        }

        function formatDate(date) {
            return date.toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'short', 
                day: 'numeric' 
            });
        }

        function escapeHtml(text) {
            if (!text) return '';
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        // Event Handlers
        function deleteExpenseHandler(id) {
            if (confirm('Are you sure you want to delete this expense?')) {
                if (expenseTracker.deleteExpense(id)) {
                    expenseTracker.showAlert('Expense deleted successfully!', 'success');
                    expenseTracker.refreshUI();
                } else {
                    expenseTracker.showAlert('Error deleting expense', 'error');
                }
            }
        }

        // Form submission
        document.getElementById('expenseForm').addEventListener('submit', (e) => {
            e.preventDefault();
            
            const amount = parseFloat(document.getElementById('amount').value);
            const category = document.getElementById('category').value;
            const description = document.getElementById('description').value;
            const dateInput = document.getElementById('date').value;
            const date = dateInput ? new Date(dateInput) : new Date();
            
            if (!category) {
                expenseTracker.showAlert('Please select a category', 'error');
                return;
            }
            
            const result = expenseTracker.addExpense(amount, category, description, date);
            
            if (result.success) {
                expenseTracker.showAlert('Expense added successfully!', 'success');
                document.getElementById('expenseForm').reset();
                document.getElementById('date').value = new Date().toISOString().split('T')[0];
                expenseTracker.refreshUI();
            } else {
                expenseTracker.showAlert('Error: ' + result.error, 'error');
            }
        });

        // Set default date
        document.getElementById('date').value = new Date().toISOString().split('T')[0];
        
        // Initial UI refresh
        expenseTracker.refreshUI();
