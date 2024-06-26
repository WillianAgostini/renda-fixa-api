import moment from 'moment';
import { DateTransformer } from 'src/transformer/date-transformer';
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('investment')
export class Investment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  issuer: string;

  @Column({ type: 'varchar', nullable: false })
  type: 'LCA' | 'LCI' | 'CDB';

  @Column({ type: 'varchar', nullable: false, name: 'origin_bank' })
  originBank: string;

  @Column({ type: 'decimal', nullable: false, name: 'minimum_application' })
  minimumApplication: number;

  @Column({ type: 'date', nullable: false, transformer: new DateTransformer() })
  maturity: Date;

  getDaysUntilMaturity(): number {
    const now = moment();
    const maturity = moment(this.maturity);
    return maturity.diff(now, 'days');
  }

  getMonthsUntilMaturity(): number {
    const now = moment();
    const maturity = moment(this.maturity);
    return maturity.diff(now, 'months');
  }

  @Column({ type: 'decimal', nullable: false })
  profitability: number;

  @Column({ type: 'varchar', nullable: false, name: 'profitability_type' })
  profitabilityType: 'CDI';

  @CreateDateColumn({ name: 'created_at', transformer: new DateTransformer() })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', transformer: new DateTransformer() })
  updatedAt: Date;
}
