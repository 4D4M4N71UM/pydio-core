<?php
/*
 * Copyright 2007-2016 Abstrium SAS <team (at) pyd.io>
 * This file is part of the Pydio Enterprise Distribution.
 * It is subject to the End User License Agreement that you should have
 * received and accepted along with this distribution.
 */

namespace Pydio\Access\Core\Stream;

defined('AJXP_EXEC') or die('Access not allowed');

use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Message\ResponseInterface;
use Pydio\Core\Exception\ActionNotFoundException;
use Pydio\Core\Exception\AuthRequiredException;
use Pydio\Core\Exception\RepositoryLoadException;
use Pydio\Access\Core\AJXP_SchemeTranslatorWrapper;
use Pydio\Access\Core\Model\AJXP_Node;
use Pydio\Core\Services\RepositoryService;
use Pydio\Core\Utils\Utils;
use Pydio\Core\Services\CacheService;
use Pydio\Core\Http\Server;
use CommerceGuys\Guzzle\Oauth2\GrantType\AuthorizationCode;
use CommerceGuys\Guzzle\Oauth2\GrantType\RefreshToken;
use CommerceGuys\Guzzle\Oauth2\Oauth2Subscriber;
use GuzzleHttp\Client as GuzzleClient;
use Pydio\Core\Services\ConfService;
use Pydio\Core\Exception\PydioUserAlertException;
use Exception;
use Zend\Diactoros\Response\EmptyResponse;


class OAuthWrapper extends AJXP_SchemeTranslatorWrapper
{
    /**
     * @param ServerRequestInterface $request
     * @param ResponseInterface $response
     * @param callable|null $next
     * @return ResponseInterface
     * @throws AuthRequiredException
     * @throws PydioUserAlertException
     * @throws RepositoryLoadException
     */
    public static function handleRequest(ServerRequestInterface $request, ResponseInterface &$response, callable $next = null) {

        /* @var ContextInterface $ctx */
        $ctx = $request->getAttribute("ctx");
        $httpVars = $request->getParsedBody();

        // Context Variables
        $repository = $ctx->getRepository();
        $user = $ctx->getUser();

        // Repository options
        $clientId     = $repository->getContextOption($ctx, 'CLIENT_ID');
        $clientSecret = $repository->getContextOption($ctx, 'CLIENT_SECRET');
        $scope        = $repository->getContextOption($ctx, 'SCOPE');
        $authUrl      = $repository->getContextOption($ctx, 'AUTH_URL');
        $tokenUrl     = $repository->getContextOption($ctx, 'TOKEN_URL');
        $redirectUrl  = $repository->getContextOption($ctx, 'REDIRECT_URL');

        $authUrl .= '?client_id=' . $clientId .
            '&scope=' . $scope .
            '&redirect_uri=' . urlencode($redirectUrl) .
            '&response_type=code';

        // Retrieving tokens
        $tokensKey = self::getTokenKey($repository->getId(), $user->getId());
        $tokens = self::getTokens($tokensKey);

        $accessToken = $tokens[0];
        $refreshToken = $tokens[1];

        // OAuth 2 Tokens
        $oauth2Client = new GuzzleClient(['base_url' => $tokenUrl]);

        // Mandatory config
        $config = [
            'client_id'     => $clientId,
            'client_secret' => $clientSecret,
            'redirect_uri'  => $redirectUrl,
            'token_url'     => '',
            'auth_location' => 'body',
        ];

        // Non-mandatory
        if (!empty($scope)) {
            $config['scope'] = $scope;
        }

        // Setting up the subscriber
        if (!empty($httpVars['code'])) {
            // Authorization code
            $config['code'] = $httpVars['code'];

            $accessToken = new AuthorizationCode($oauth2Client, $config);
            $refreshToken = new RefreshToken($oauth2Client, $config);

            $oauth2 = new Oauth2Subscriber($accessToken, $refreshToken);
        } else if (!empty($accessToken)) {
            if (empty($refreshToken)) {
                // Using access token
                $oauth2 = new Oauth2Subscriber($accessToken, null);
                $oauth2->setAccessToken($accessToken);
            } else {
                // Refresh Token
                $config['refresh_token'] = $refreshToken;

                $oauth2 = new Oauth2Subscriber(null, new RefreshToken($oauth2Client, $config));

                $oauth2->setAccessToken($accessToken);
                $oauth2->setRefreshToken($refreshToken);
            }
        }

        if (empty($oauth2)) {
            throw new PydioUserAlertException("Please go to <a style=\"text-decoration:underline;\" href=\"" . $authUrl . "\">" . $authUrl . "</a> to authorize the access to your onedrive. Then try again to switch to this workspace");
        }

        // Retrieving access token and checking access
        try {
            $accessToken = $oauth2->getAccessToken();
            $refreshToken = $oauth2->getRefreshToken();
        } catch (\Exception $e) {
            throw new PydioUserAlertException("Please go to <a style=\"text-decoration:underline;\" href=\"" . $authUrl . "\">" . $authUrl . "</a> to authorize the access to your onedrive. Then try again to switch to this workspace");
        }

        // Saving tokens for later use
        $accessToken = $accessToken->getToken();
        if (isset($refreshToken)) {
            $refreshToken = $refreshToken->getToken();
        }
        self::setTokens($tokensKey, $accessToken, $refreshToken);

        $request = $request
            ->withAttribute('oauth2', $oauth2);
        
        $response = Server::callNextMiddleWare($request, $response, $next);

        return [$request, $response];
    }

    /**
     * @param $url
     * @return bool|void
     * @throws \Pydio\Core\Exception\PydioUserAlertException
     * @throws Exception
     */
    public static function applyInitPathHook($url) {

        if (!class_exists('CommerceGuys\Guzzle\Oauth2\Oauth2Subscriber')) {
            throw new Exception('Oauth plugin not loaded - go to ' . AJXP_BIN_FOLDER . '/guzzle from the command line and run \'composer update\' to install');
        }

        // Repository information
        $urlParts = Utils::safeParseUrl($url);
        $repository = GuzzleClient::getRepositoryById($urlParts["host"]);

        if ($repository == null) {
            throw new Exception("Cannot find repository");
        }

        $repositoryId = $repository->getId();

        $ctx = AJXP_Node::contextFromUrl($url);
        if($ctx->hasUser()) {
            $u = $ctx->getUser();
            $userId = $u->getId();
        } else {
            $userId = 'shared';
        }

        // User information
        // Repository params
        $clientId     = $repository->getContextOption($ctx, 'CLIENT_ID');
        $clientSecret = $repository->getContextOption($ctx, 'CLIENT_SECRET');
        $scope        = $repository->getContextOption($ctx, 'SCOPE');
        $authUrl      = $repository->getContextOption($ctx, 'AUTH_URL');
        $tokenUrl     = $repository->getContextOption($ctx, 'TOKEN_URL');
        $redirectUrl  = $repository->getContextOption($ctx, 'REDIRECT_URL');

        $authUrl .= '?client_id=' . $clientId .
                    '&scope=' . $scope .
                    '&redirect_uri=' . urlencode($redirectUrl) .
                    '&response_type=code';

        // Retrieving context
        $repoData = self::actualRepositoryWrapperData($urlParts["host"]);
        $repoProtocol = $repoData['protocol'];

        $default = stream_context_get_options(stream_context_get_default());

        // Retrieving subscriber
        $oauth2 = $default[$repoProtocol]['oauth2_subscriber'];

        if (!empty($oauth2)) {
            // Authentication already made for this request - move on
            return true;
        }

        // Retrieving tokens
        $tokensKey = self::getTokenKey($repositoryId, $userId);
        $tokens = self::getTokens($tokensKey);

        $accessToken = $tokens[0];
        $refreshToken = $tokens[1];

        // OAuth 2 Tokens
        $oauth2Client = new GuzzleClient(['base_url' => $tokenUrl]);

        // Mandatory config
        $config = [
            'client_id'     => $clientId,
            'client_secret' => $clientSecret,
            'redirect_uri'  => $redirectUrl,
            'token_url'     => '',
            'auth_location' => 'body',
        ];

        // Non-mandatory
        if (!empty($scope)) {
            $config['scope'] = $scope;
        }

        // Setting up the subscriber
        if (!empty($_SESSION['oauth_code'])) {
            // Authorization code
            $config['code'] = $_SESSION['oauth_code'];

            $accessToken = new AuthorizationCode($oauth2Client, $config);
            $refreshToken = new RefreshToken($oauth2Client, $config);

            $oauth2 = new Oauth2Subscriber($accessToken, $refreshToken);

            unset($_SESSION['oauth_code']);
        } else if (!empty($accessToken)) {
            if (empty($refreshToken)) {
                // Using access token
                $oauth2 = new Oauth2Subscriber($accessToken, null);
                $oauth2->setAccessToken($accessToken);
            } else {
                // Refresh Token
                $config['refresh_token'] = $refreshToken;

                $oauth2 = new Oauth2Subscriber(null, new RefreshToken($oauth2Client, $config));

                $oauth2->setAccessToken($accessToken);
                $oauth2->setRefreshToken($refreshToken);
            }
        }

        if (empty($oauth2)) {
            throw new PydioUserAlertException("Please go to <a style=\"text-decoration:underline;\" href=\"" . $authUrl . "\">" . $authUrl . "</a> to authorize the access to your onedrive. Then try again to switch to this workspace");
        }
        
        // Retrieving access token and checking access
        try {
            $accessToken = $oauth2->getAccessToken();
            $refreshToken = $oauth2->getRefreshToken();
        } catch (\Exception $e) {
            throw new PydioUserAlertException("Please go to <a style=\"text-decoration:underline;\" href=\"" . $authUrl . "\">" . $authUrl . "</a> to authorize the access to your onedrive. Then try again to switch to this workspace");
        }

        // Saving tokens for later use
        $accessToken = $accessToken->getToken();
        if (isset($refreshToken)) {
            $refreshToken = $refreshToken->getToken();
        }
        self::setTokens($tokensKey, $accessToken, $refreshToken);

        // Saving subscriber in context
        $default[$repoProtocol]['oauth2_subscriber'] = $oauth2;

        // Retrieving client
        $client = $default[$repoProtocol]['client'];
        $httpClient = $client->getHttpClient();
        $httpClient->getEmitter()->attach($oauth2);

        stream_context_set_default($default);

        return true;
    }

    /**
     * @return string key
     */
    private static function getTokenKey($repositoryId, $userId) {
        return 'OAUTH_ONEDRIVE_' . $repositoryId . '_' . $userId . '_TOKENS';
    }
    /**
     * @return array
     */
    private static function getTokens($key)
    {
        // TOKENS IN SESSION?
        if (!empty($_SESSION[$key])) return $_SESSION[$key];

        // TOKENS IN CACHE?
        if ($tokens = CacheService::fetch(AJXP_CACHE_SERVICE_NS_SHARED, $key)) return $tokens;

        // TOKENS IN FILE ?
        return Utils::loadSerialFile(AJXP_DATA_PATH . '/plugins/access.onedrive/' . $key);
    }

    /**
     * @param $key
     * @param $accessToken
     * @param $refreshToken
     * @return bool
     * @throws Exception
     * @internal param $oauth_tokens
     */
    private function setTokens($key, $accessToken, $refreshToken)
    {
        $value = [$accessToken, $refreshToken];

        // Save in file
        Utils::saveSerialFile(AJXP_DATA_PATH . '/plugins/access.dropbox/' . $key, $value, true);

        // Save in cache
        CacheService::save(AJXP_CACHE_SERVICE_NS_SHARED, $key, $value);

        // Save in session
        $_SESSION["OAUTH_ONEDRIVE_TOKENS"] = $value;

        return true;
    }

}