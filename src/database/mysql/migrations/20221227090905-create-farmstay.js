'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('farmstays', {
      id: {
        type: Sequelize.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      uuid: {
        type: 'BINARY(16)',
        allowNull: false,
        unique: true
      },
      name:{
        type: Sequelize.STRING,
        allowNull: false,
      },
      slug:{
        type: Sequelize.STRING,
        allowNull: true,
      },
      rent_cost_per_day:{
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: true
      },
      manager_id:{
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: true
      },
      description:{
        type: Sequelize.TEXT,
        allowNull: true
      },
      images:{
        type: Sequelize.JSON,
        allowNull: true
      },
      square_meter:{
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: true
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      deletedAt: {
        allowNull: true,
        type: Sequelize.DATE
      }
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('farmstays');
  }
};