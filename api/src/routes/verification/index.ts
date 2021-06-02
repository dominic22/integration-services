import { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { VerifiableCredentialJson } from '../../models/types/identity';
import { VerificationService } from '../../services/verification-service';
import { Config } from '../../models/config';
import { AuthenticatedRequest, AuthorizationCheck, RevokeVerificationBody, VerifyIdentityBody } from '../../models/types/authentication';
import { UserService } from '../../services/user-service';
import { User, UserRoles } from '../../models/types/user';
import * as KeyCollectionLinksDb from '../../database/verifiable-credentials';
import { AuthorizationService } from '../../services/authorization-service';
import { VerifiableCredentialPersistence } from '../../models/types/key-collection';

export class VerificationRoutes {
	private readonly verificationService: VerificationService;
	readonly authorizationService: AuthorizationService;
	readonly userService: UserService;
	private readonly config: Config;

	constructor(verificationService: VerificationService, userService: UserService, authorizationService: AuthorizationService, config: Config) {
		this.verificationService = verificationService;
		this.authorizationService = authorizationService;
		this.userService = userService;
		this.config = config;
	}

	createVerifiableCredential = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
		try {
			const verifyIdentityBody: VerifyIdentityBody = req.body;
			const { initiatorVC, subjectId, checkExistingVC } = verifyIdentityBody;
			const requestUser = req.user;
			const subject = await this.userService.getUser(subjectId);
			if (!subject) {
				throw new Error('subject does not exist!');
			}

			if (!requestUser.identityId && !initiatorVC?.credentialSubject?.id) {
				throw new Error('no initiator id could be found!');
			}

			// check existing vcs and update verification state based on it
			if (!initiatorVC && checkExistingVC) {
				return await this.verifyByExistingVCs(res, subject, requestUser.identityId);
			}

			const { isAuthorized, error } = await this.isAuthorizedToVerify(subject, initiatorVC, requestUser);
			if (!isAuthorized) {
				throw error;
			}

			const vc: VerifiableCredentialJson = await this.verificationService.verifyIdentity(
				subject,
				this.config.serverIdentityId,
				initiatorVC?.credentialSubject?.id || requestUser.identityId
			);

			res.status(StatusCodes.OK).send(vc);
		} catch (error) {
			next(error);
		}
	};

	verifyByExistingVCs = async (res: Response, user: User, requestId: string) => {
		const hasVerifiedVCs = await this.verificationService.hasVerifiedVerifiableCredential(user.verifiableCredentials);
		const date = new Date();
		const vup = {
			identityId: user.identityId,
			verified: hasVerifiedVCs,
			lastTimeChecked: date,
			verificationDate: date,
			verificationIssuerId: requestId
		};
		await this.userService.updateUserVerification(vup);
		res.status(StatusCodes.OK).send(vup);
	};

	checkVerifiableCredential = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
		try {
			const vcBody: VerifiableCredentialJson = req.body;
			const isVerified = await this.verificationService.checkVerifiableCredential(vcBody);
			res.status(StatusCodes.OK).send({ isVerified });
		} catch (error) {
			next(error);
		}
	};

	revokeVerifiableCredential = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
		try {
			const revokeBody: RevokeVerificationBody = req.body;
			const requestUser = req.user;

			const vcp = await KeyCollectionLinksDb.getVerifiableCredential(revokeBody.subjectId, revokeBody.signatureValue, this.config.serverIdentityId);
			if (!vcp) {
				throw new Error('no vc found to revoke the verification!');
			}
			const { isAuthorized, error } = await this.isAuthorizedToRevoke(vcp, requestUser);
			if (!isAuthorized) {
				throw error;
			}

			await this.verificationService.revokeVerifiableCredential(vcp, this.config.serverIdentityId);

			res.sendStatus(StatusCodes.OK);
		} catch (error) {
			next(error);
		}
	};

	getLatestDocument = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
		try {
			const decodeParam = (param: string): string | undefined => (param ? decodeURI(param) : undefined);
			const did = req.params && decodeParam(<string>req.params['identityId']);

			if (!did) {
				res.sendStatus(StatusCodes.BAD_REQUEST);
				return;
			}

			const doc = await this.verificationService.getLatestDocument(did);

			res.status(StatusCodes.OK).send(doc);
		} catch (error) {
			next(error);
		}
	};

	getTrustedRootIdentities = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
		try {
			const trustedRoots = await this.verificationService.getTrustedRootIds();
			res.status(StatusCodes.OK).send({ trustedRoots });
		} catch (error) {
			next(error);
		}
	};

	isAuthorizedToRevoke = async (kci: VerifiableCredentialPersistence, requestUser: User): Promise<AuthorizationCheck> => {
		const isAuthorizedUser = this.authorizationService.isAuthorizedUser(requestUser.identityId, kci.vc.id);
		const isAuthorizedInitiator = this.authorizationService.isAuthorizedUser(requestUser.identityId, kci.initiatorId);
		if (!isAuthorizedUser && !isAuthorizedInitiator) {
			const isAuthorizedAdmin = await this.authorizationService.isAuthorizedAdmin(requestUser, kci.vc.id);
			if (!isAuthorizedAdmin) {
				return { isAuthorized: false, error: new Error('not allowed to revoke credential!') };
			}
		}

		return { isAuthorized: true, error: null };
	};

	isAuthorizedToVerify = async (subject: User, initiatorVC: VerifiableCredentialJson, requestUser: User): Promise<AuthorizationCheck> => {
		const isAdmin = requestUser.role === UserRoles.Admin;
		if (!isAdmin || !this.authorizationService.hasAuthorizationType(requestUser.type)) {
			if (!initiatorVC || !initiatorVC.credentialSubject) {
				return { isAuthorized: false, error: new Error('no valid verfiable credential!') };
			}

			if (requestUser.identityId !== initiatorVC.credentialSubject.id || requestUser.identityId !== initiatorVC.id) {
				return { isAuthorized: false, error: new Error('user id of request does not concur with the initiatorVC user id!') };
			}

			if (
				!this.authorizationService.hasAuthorizationType(initiatorVC.credentialSubject.type) &&
				!this.authorizationService.hasAuthorizationType(requestUser.type)
			) {
				return { isAuthorized: false, error: new Error('initiator is not allowed based on its type!') };
			}

			if (
				(initiatorVC.credentialSubject.organization || subject.organization) &&
				subject.organization !== initiatorVC.credentialSubject.organization
			) {
				return { isAuthorized: false, error: new Error('user must be in same organization!') };
			}

			const isInitiatorVerified = await this.verificationService.checkVerifiableCredential(initiatorVC);
			if (!isInitiatorVerified) {
				return { isAuthorized: false, error: new Error('initiator has to be verified!') };
			}
		}
		return { isAuthorized: true, error: null };
	};
}