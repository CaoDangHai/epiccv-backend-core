import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CandidateController } from './candidate.controller';
import { CandidateService } from './candidate.service';
import { Candidate } from '../database/entities/candidate.entity';

@Module({
    imports: [TypeOrmModule.forFeature([Candidate])],
    controllers: [CandidateController],
    providers: [CandidateService],
    exports: [CandidateService],
})
export class CandidateModule { }