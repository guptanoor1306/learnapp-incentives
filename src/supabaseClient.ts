class SupabaseQueryBuilder {
  private table: string;
  private method: string = 'select';
  private selectStr: string = '*';
  private filters: Array<{ col: string; val: any; op: string }> = [];
  private orders: Array<{ col: string; ascending: boolean }> = [];
  private isSingle: boolean = false;
  private data: any = null;

  constructor(table: string) {
    this.table = table;
  }

  select(selectStr: string = '*', _options?: any) {
    this.method = 'select';
    this.selectStr = selectStr;
    return this;
  }

  eq(col: string, val: any) {
    this.filters.push({ col, val, op: 'eq' });
    return this;
  }

  neq(col: string, val: any) {
    this.filters.push({ col, val, op: 'neq' });
    return this;
  }

  in(col: string, val: any[]) {
    this.filters.push({ col, val, op: 'in' });
    return this;
  }

  order(col: string, options?: { ascending?: boolean }) {
    this.orders.push({ col, ascending: options?.ascending !== false });
    return this;
  }

  single() {
    this.isSingle = true;
    return this;
  }

  async then(onfulfilled?: (value: any) => any) {
    try {
      const res = await this.execute();
      if (onfulfilled) return onfulfilled(res);
      return res;
    } catch (err) {
      if (onfulfilled) return onfulfilled({ data: null, error: err, count: 0 });
      return { data: null, error: err, count: 0 };
    }
  }

  insert(data: any) {
    this.method = 'insert';
    this.data = data;
    return this;
  }

  update(data: any) {
    this.method = 'update';
    this.data = data;
    return this;
  }

  delete() {
    this.method = 'delete';
    return this;
  }

  private async execute() {
    const response = await fetch('/api/db', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        table: this.table,
        method: this.method,
        selectStr: this.selectStr,
        filters: this.filters,
        orders: this.orders,
        isSingle: this.isSingle,
        data: this.data,
      }),
    });

    const responseText = await response.text();
    let result: any = null;
    try {
      result = responseText ? JSON.parse(responseText) : null;
    } catch {
      return { data: null, error: new Error(responseText || 'Invalid database response'), count: 0 };
    }

    if (!response.ok) {
      return { data: null, error: new Error(result?.error || 'Database request failed'), count: 0 };
    }

    const count = Array.isArray(result?.data) ? result.data.length : (result?.data ? 1 : 0);
    return { data: result?.data, error: null, count };
  }
}

export const supabase = {
  from(table: string) {
    return new SupabaseQueryBuilder(table);
  },
};
