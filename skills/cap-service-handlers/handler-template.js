const cds = require('@sap/cds');
const { SELECT } = cds.ql;

module.exports = class CatalogService extends cds.ApplicationService {
  async init() {
    const { Products } = this.entities;

    this.before('CREATE', Products, this.validateProduct);
    this.after('READ', Products, this.computeAvailability);
    this.on('submitOrder', this.onSubmitOrder);

    await super.init();
  }

  async validateProduct(req) {
    const { price, name } = req.data;
    if (!name) req.error(400, 'Name is required', 'name');
    if (price < 0) req.error(400, 'Price must be positive', 'price');
  }

  computeAvailability(results) {
    for (const each of results) {
      each.available = each.stock > 0;
    }
  }

  async onSubmitOrder(req) {
    const { orderID } = req.data;
    const order = await SELECT.one.from('Orders').where({ ID: orderID });
    if (!order) return req.reject(404, `Order ${orderID} not found`);
    // business logic delegated to srv/lib/
  }
};
